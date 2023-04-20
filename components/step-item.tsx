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
import { applyEventsToLayoutContent, useResponse, run, classNames } from '../utils/common'
import { v4 as uuidv4 } from 'uuid'


export const StepItem = ({ userID, step, stepID, progress, experiment, flowSteps,
    onResponseAssess, contentTypes, contentSettings, setContentSettings,
    loadPriorResponses
}) => {
    const router = useRouter(),
        db = useFirestore(),
        [response, setResponse] = useResponse(stepID)

    var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)

    // Maintain the state of the last persisted attempt.
    var stepProgress = progress && progress.steps && progress.steps[stepID]
    const [attempts, setAttempts] = useState(stepProgress?.attempts)

    useEffect(() => {
        if (response.hasOwnProperty(stepID)){
            // Only persist the changed props.
            var responseProps = Object.keys(response[stepID]),
                responsePropsToPersist = []

            if (attempts){
                ([...attempts]).reverse().forEach(attempt => {
                    var prop;
                    for (prop in attempt.response){
                        if (responseProps.indexOf(prop) !== -1){
                            if (JSON.stringify(attempt.response[prop]) === JSON.stringify(response[stepID][prop])){
                                responseProps.splice(responseProps.indexOf(prop), 1)
                            } else {
                                responsePropsToPersist.push(prop)
                            }
                        }
                    }
                })
            } else {
                responsePropsToPersist = responseProps;
            }

            var responseWithChangedPropsOnly = {}
            responsePropsToPersist.forEach(prop => {
                responseWithChangedPropsOnly[prop] = response[stepID][prop]
            })

            if (Object.keys(responseWithChangedPropsOnly).length){
                var latestAttempt = {
                    timestamp: Timestamp.now(), response: responseWithChangedPropsOnly
                }

                setAttempts(attempts => {
                    var newAttempts = [...(attempts || [])]
                    newAttempts.push(latestAttempt)
                    return newAttempts
                })

                updateDoc(flowProgressRef, {
                    [`steps.${stepID}.attempts`]: arrayUnion(latestAttempt)
                })
            }
        }
    }, [response])

    var layout = step ? applyExperimentToLayout(step.layout && JSON.parse(step.layout), experiment, stepID) : null,
        layoutContent = step ? applyEventsToLayoutContent(applyExperimentToLayoutContent(step.layoutContent && JSON.parse(step.layoutContent), experiment, stepID), {
            ...step.events, current: router.query['event:click']
        }) : null,
        responseCheck = step ? applyExperimentToResponseCheck(step.responseCheck, experiment, stepID) : null

    // Merge the response and progress.
    var lastUserResponse
    if (attempts && loadPriorResponses){
        // var lastAttempt = attempts[attempts.length - 1]
        //
        // if (lastAttempt && lastAttempt.response){
        //     lastUserResponse = lastAttempt.response
        // }
        var prop
        lastUserResponse = {}
        attempts.forEach(attempt => {
            for (prop in attempt.response){
                lastUserResponse[prop] = attempt.response[prop]
            }
        })
    }

    // If, however, we have a response in our current state, that's the one.
    if (response[stepID]){
        lastUserResponse = response[stepID]
    }

    return <div>
        {step && progress ? <div className={styles.GridLayoutWrapper + ' mx-auto'} style={{ width: '1200px' }}><GridLayout
              className="layout"
              layout={layout}
              cols={36}
              rowHeight={12}
              width={1200}
              isResizable={false}
              isDraggable={false}
              isDroppable={false}
              compactType={null}
            >
                {layout.map(box => {
                    var contentType = contentTypes.find(ct => layoutContent && layoutContent[box.i] && (layoutContent[box.i].kind === ct.kind || layoutContent[box.i].name.startsWith(ct.kind))),
                        content = layoutContent && layoutContent[box.i]

                    return <div key={box.i}>
                        <BoxBody content={content}
                            checkResponse={function(responseCheck, name, isStepCheck){
                                var answeredCorrectly = false
                                if (lastUserResponse){
                                    let variableDeclations = [], tempVariableName
                                    var cleanedResponseCheck = responseCheck

                                    for (var prop in lastUserResponse){
                                        if (prop !== 'timestamp'){
                                            tempVariableName = 'v' + uuidv4().substring(0, 5)
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
                                        answeredCorrectly = Function(`'use strict'; ${variableDeclations ? 'var ' + variableDeclations.join(',') : ''}; return (${cleanedResponseCheck})`)()
                                    } catch (e){
                                        console.log('Failure to assess answer', e)
                                    }

                                    if (answeredCorrectly){
                                        if (isStepCheck){
                                            updateDoc(flowProgressRef, {
                                                [`steps.${stepID}.completed`]: 100,
                                                completed: increment(
                                                    (progress.steps && progress.steps[stepID] && progress.steps[stepID].completed) === 100 ? 0 : (100 / flowSteps.length)
                                                )
                                            })

                                            updateDoc(doc(db, "flows", router.query.flowid), {
                                                [`progress.${userID}.steps.${stepID}.completed`]: 100
                                            })

                                            onResponseAssess(true)
                                        }
                                    } else {
                                        if (isStepCheck){
                                            onResponseAssess(false)
                                        }
                                    }
                                }

                                setResponse({ ...response, [stepID]: {
                                    ...(response[stepID] || {}), [`{${name}}`]: { clicked: true, clickFormulaSucceeded: answeredCorrectly } }
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
                            flowSteps={flowSteps}
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


const BoxBody = ({ content, response, checkResponse, setResponse, contentFormatting, stepID, render, contentSettings, setContentSettings, contentEvents, flowSteps }) => {
    const router = useRouter()

    if (!content || !render)
        return null

    var formatting = {...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {})}

    if (content.properties?.showCondition){
        if (!run(content.properties.showCondition, response)){
            return null
        }
    }

    var isClickable = (content.properties?.onClick || contentEvents && contentEvents.click),
        isClicked = isClickable && ((content.name === router.query['event:click']) || (window.location.href === content.properties?.onClick?.body))

    return <div data-contentname={content.name}
            className={classNames('h-full', isClickable ? 'cursor-pointer' : '',
            isClicked ? 'border-2' : '')}
            onClick={() => {
                var action = content.properties?.onClick && content.properties?.onClick?.action

                if (action === 'open-link'){
                    if (content.properties.onClick.body.startsWith(window.location.origin)){
                        router.push(content.properties.onClick.body)
                    } else {
                        window.location.href = content.body.properties.onClick.body
                    }

                } else if (action === 'run-formula'){
                    checkResponse(
                        content.properties.onClick.body?.formula, content.name,
                        content.properties.onClick.body?.isStepCheck
                    )

                } else if (action === 'advance-to-next-step'){
                    var indexOfCurrentStep = flowSteps.findIndex(step => step.id === stepID)

                    if (indexOfCurrentStep === flowSteps.length - 1){
                        router.push(`/app/${router.query.appid}/flow/${router.query.flowid}`)
                    } else {
                        router.push(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${flowSteps[indexOfCurrentStep + 1].id}${window.location.search}`)
                    }

                } else if (action === 'go-to-previous-step'){
                    var indexOfCurrentStep = flowSteps.findIndex(step => step.id === stepID)

                    if (indexOfCurrentStep !== 0){
                        router.push(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${flowSteps[indexOfCurrentStep - 1].id}${window.location.search}`)
                    }

                } else if (action === 'return-to-flow'){
                    router.push(`/app/${router.query.appid}/flow/${router.query.flowid}${window.location.search}`)

                } else if (action === 'change-ui' && contentEvents && contentEvents.click){
                    var searchParams = new URLSearchParams(window.location.search)

                    const url = new URL(window.location.href)
                    searchParams.set('event:click', content.name)
                    url.search = new URLSearchParams(searchParams)

                    router.push(url.toString())
                }

            }}>
            {render(content.body, formatting, {contentFormatting, stepID, checkResponse, response, setResponse, name: content.name })}
    </div>
}
