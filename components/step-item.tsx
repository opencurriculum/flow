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
import { applyEventsToLayoutContent, useResponse, run } from '../utils/common'
import { v4 as uuidv4 } from 'uuid'


export const StepItem = ({ userID, step, stepID, progress, experiment, flowSteps, onResponseAssess, contentTypes, contentSettings, setContentSettings }) => {
    const router = useRouter(),
        db = useFirestore(),
        [response, setResponse] = useResponse(stepID)

    var layout = step ? applyExperimentToLayout(step.layout && JSON.parse(step.layout), experiment, stepID) : null,
        layoutContent = step ? applyEventsToLayoutContent(applyExperimentToLayoutContent(step.layoutContent && JSON.parse(step.layoutContent), experiment, stepID), {
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
                    var contentType = contentTypes.find(ct => layoutContent && layoutContent[box.i] && (layoutContent[box.i].kind === ct.kind || layoutContent[box.i].name.startsWith(ct.kind))),
                        content = layoutContent && layoutContent[box.i]

                    return <div key={box.i}>
                        <BoxBody content={content}
                            checkResponse={function(responseCheck, name){
                                var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
                                var answeredCorrectly = false
                                if (lastUserResponse){
                                    let variableDeclations = [], tempVariableName
                                    var cleanedResponseCheck = responseCheck.value

                                    for (var prop in lastUserResponse){
                                        if (prop !== 'timestamp'){
                                            tempVariableName = 'var ' + uuidv4().substring(0, 5)
                                            cleanedResponseCheck = cleanedResponseCheck.replace(prop, tempVariableName)

                                            if (typeof(lastUserResponse[prop]) === 'object'){
                                                variableDeclations.push(`${tempVariableName} = ${JSON.stringify(lastUserResponse[prop])}`)
                                            } else if (typeof(lastUserResponse[prop]) === 'number' || lastUserResponse[prop].match(/^-?\d+\.?\d*$/)){
                                                variableDeclations.push(`${tempVariableName} = ${lastUserResponse[prop]}`)
                                            } else {
                                                variableDeclations.push(`${tempVariableName} = "${lastUserResponse[prop]}"`)
                                            }
                                        }
                                    }

                                    try {
                                        answeredCorrectly = Function(`'use strict'; var ${variableDeclations.join(',')}; return (${cleanedResponseCheck})`)()
                                    } catch (e){
                                        console.log('Failure to assess answer', e)
                                    }

                                    if (answeredCorrectly){
                                        updateDoc(flowProgressRef, {
                                            [`steps.${stepID}.attempts`]: arrayUnion({
                                                timestamp: Timestamp.now(), response: lastUserResponse
                                            }),
                                            [`steps.${stepID}.completed`]: 100,
                                            completed: increment(
                                                (progress.steps && progress.steps[stepID] && progress.steps[stepID].completed) === 100 ? 0 : (100 / flowSteps.length)
                                            )
                                        })

                                        updateDoc(doc(db, "flows", router.query.flowid), {
                                            [`progress.${userID}.steps.${stepID}.completed`]: 100
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

                                setResponse({ ...response, [stepID]: {
                                    ...(response[stepID] || {}), [`{${name}}`]: { answered: true, answeredCorrectly } }
                                })
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

    if (content.body?.properties?.showCondition){
        if (!run(content.body.properties.showCondition, response)){
            return null
        }
    }

    return <div onClick={contentEvents && contentEvents.click ? () => {
            var searchParams = new URLSearchParams(window.location.search)

            const url = new URL(window.location.href)
            searchParams.set('event:click', content.name)
            url.search = new URLSearchParams(searchParams)

            router.replace(url.toString())

        } : null} className={'h-full' + (contentEvents && contentEvents.click ? ' cursor-pointer' : '')} data-contentname={content.name}>
        {render(content.body, formatting, {contentFormatting, stepID, checkResponse, response, setResponse, name: content.name })}
    </div>
}
