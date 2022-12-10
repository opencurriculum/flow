import {useState, useEffect, useRef} from 'react'
import {
    collection, getDocs, getDoc, doc, updateDoc, setDoc, arrayUnion,
    increment, Timestamp, documentId, query, where
} from "firebase/firestore"
import 'react-grid-layout/css/styles.css'
import GridLayout from "react-grid-layout"
import {Editor, EditorState, ContentState, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { useRouter } from 'next/router'
import {
    applyExperimentToLayoutContent,
    applyExperimentToLayout, applyExperimentToContentFormatting,
    applyExperimentToResponseCheck
} from '../utils/experimentation.tsx'
import styles from '../styles/components/StepAdmin.module.sass'
import { useFirestore, useAnalytics } from 'reactfire'
import { applyEventsToLayoutContent } from '../utils/common'
import { v4 as uuidv4 } from 'uuid'


const slateHost = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://slate-eta.vercel.app'

export const StepItem = ({ userID, step, stepID, progress, experiment, flowSteps, onResponseAssess, contentTypes, contentSettings, setContentSettings }) => {
    const [response, setResponse] = useState({})

    const router = useRouter(),
        db = useFirestore()

    var processIframeData = function(event){
        if (event.origin  === slateHost){
            var eventResponses = {}

            // Determine which content it is coming from.
            var iframes = document.getElementsByTagName('iframe'), i = 0,
                contentName
            for (i = 0; i < iframes.length; i++){
                if (event.source === iframes[i].contentWindow){
                    var parent = iframes[i].parentNode
                    while (!contentName && parent !== document.body){
                        contentName = parent.dataset.contentname
                        parent = parent.parentNode
                    }
                    break
                }
            }

            event.data?.data.forEach(
                pieceOfData => eventResponses[`{${contentName}}.${pieceOfData.id}`] = pieceOfData.value)

            setResponse({ ...response, [stepID]: {
                ...(response[stepID] || {}), ...eventResponses }
            })
        }
    }

    useEffect(() => {
        window.addEventListener('message', processIframeData);

        return () => {
            window.removeEventListener('message', processIframeData);
        }
    }, [])


    var layout = step ? applyExperimentToLayout(JSON.parse(step.layout), experiment, stepID) : null,
        layoutContent = step ? applyEventsToLayoutContent(applyExperimentToLayoutContent(JSON.parse(step.layoutContent), experiment, stepID), {
            ...step.events, current: router.query['event:click']
        }) : null,
        responseCheck = step ? applyExperimentToResponseCheck(step.responseCheck, experiment, stepID) : null

    // Merge the response and progress.
    var lastUserResponse
    var stepProgress = progress && progress.steps && progress.steps[stepID]
    if (stepProgress && stepProgress.attempts){
        var lastAttempt = stepProgress.attempts[stepProgress.attempts.length - 1]

        if (lastAttempt && lastAttempt.response){
            lastUserResponse = lastAttempt.response
        }
    }

    // If, however, we have a response in our current state, that's the one.
    if (response[stepID]){
        lastUserResponse = response[stepID]
    }

    return <div>
        {step ? <div className={styles.GridLayoutWrapper + ' mx-auto'} style={{ width: '1200px' }}><GridLayout
              className="layout"
              layout={layout}
              cols={36}
              rowHeight={12}
              width={1200}
              isResizable={false}
              isDraggable={false}
              isDroppable={false}
            >
                {layout.map(box => {
                    var contentType = contentTypes.find(ct => layoutContent[box.i] && (layoutContent[box.i].kind === ct.kind || layoutContent[box.i].name.startsWith(ct.kind))),
                        content = layoutContent[box.i]

                    return <div key={box.i}>
                        <BoxBody content={content}
                            checkResponse={function(responseCheck){
                                var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
                                if (lastUserResponse){
                                    let variableDeclations = [], tempVariableName
                                    var cleanedResponseCheck = responseCheck.value

                                    for (var prop in lastUserResponse){
                                        if (prop !== 'timestamp'){
                                            tempVariableName = 'var' + uuidv4().substring(0, 5)
                                            cleanedResponseCheck = cleanedResponseCheck.replace(prop, tempVariableName)
                                            variableDeclations.push(lastUserResponse[prop].match(/^-?\d+\.?\d*$/) ? (
                                                `${tempVariableName} = ${lastUserResponse[prop]}`) : `${tempVariableName} = "${lastUserResponse[prop]}"`
                                            )
                                        }
                                    }
                                    if (Function(`'use strict'; var ${variableDeclations.join(',')}; return (${cleanedResponseCheck})`)()){
                                        updateDoc(flowProgressRef, {
                                            [`steps.${stepID}.attempts`]: arrayUnion({
                                                timestamp: Timestamp.now(), response: lastUserResponse
                                            }),
                                            [`steps.${stepID}.completed`]: 100,
                                            completed: increment(
                                                (progress.steps && progress.steps[stepID] && progress.steps[stepID].completed) === 100 ? 0 : (100 / flowSteps.length)
                                            )
                                        })

                                        onResponseAssess(true)
                                    } else {
                                        onResponseAssess(false)

                                        updateDoc(flowProgressRef, {
                                            [`steps.${stepID}.attempts`]: arrayUnion({
                                                timestamp: Timestamp.now(), response: lastUserResponse
                                            }),
                                        })
                                    }
                                }

                            }}
                            response={lastUserResponse}
                            setResponse={(id, value) => {
                                setResponse({ ...response, [stepID]: {
                                    ...(response[stepID] || {}), [id]: value }
                                })
                            }}
                            contentFormatting={applyExperimentToContentFormatting(step.contentFormatting, experiment, stepID)}
                            stepID={stepID}

                            render={contentType?.render}
                            contentSettings={contentSettings}
                            setContentSettings={setContentSettings}

                            contentEvents={content ? (step.events && step.events[content.name]) : null}
                        />
                    </div>
                })}
            </GridLayout>
            {<style jsx global>{`
                .${styles.GridLayoutWrapper} .textAlign-center .public-DraftStyleDefault-ltr {
                    text-align: center
                }
            `}</style>}
        </div> : null}
    </div>
}


const BoxBody = ({ content, response, checkResponse, setResponse, contentFormatting, stepID, render, contentSettings, setContentSettings, contentEvents }) => {
    const router = useRouter()

    if (!content || !render)
        return null

    var formatting = {...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {})}

    return <div className='h-full' onClick={contentEvents && contentEvents.click ? () => {
            var searchParams = new URLSearchParams(window.location.search)

            const url = new URL(window.location.href)
            searchParams.set('event:click', content.name)
            url.search = new URLSearchParams(searchParams)

            router.replace(url.toString())

        } : null} className={contentEvents && contentEvents.click ? 'cursor-pointer' : ''} data-contentname={content.name}>
        {render(content.body, formatting, {contentFormatting, stepID, checkResponse, response, setResponse})}
    </div>
}
