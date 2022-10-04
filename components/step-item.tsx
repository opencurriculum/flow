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
    blockStyleFn, applyExperimentToLayoutContent,
    applyExperimentToLayout, applyExperimentToContentFormatting
} from '../utils/common.tsx'
import styles from '../styles/components/StepAdmin.module.sass'
import { useFirestore, useAnalytics } from 'reactfire'


export const StepItem = ({ userID, step, stepID, progress, experiment, flowSteps, onResponseAssess }) => {
    const [response, setResponse] = useState({})

    const router = useRouter(),
        db = useFirestore()

    var layout = step ? applyExperimentToLayout(JSON.parse(step.layout), experiment, stepID) : null,
        layoutContent = step ? applyExperimentToLayoutContent(JSON.parse(step.layoutContent), experiment, stepID) : null

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
        {step ? <div className={styles.GridLayoutWrapper}><GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={30}
              width={1200}
              isResizable={false}
              isDraggable={false}
              isDroppable={false}
            >
                {layout.map(box => <div key={box.i}>
                    <BoxBody content={layoutContent[box.i]}
                        checkResponse={function(){
                            var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
                            if (lastUserResponse){
                                let variableDeclations = []
                                for (var prop in lastUserResponse){
                                    if (prop !== 'timestamp'){
                                        variableDeclations.push(`${prop} = ${lastUserResponse[prop]}`)
                                    }
                                }
                                if (Function(`'use strict'; var ${variableDeclations.join(',')}; return (${step.responseCheck})`)()){
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
                                ...(response[stepID] ? response[stepID] : {}), [id]: value }
                            })
                        }}
                        contentFormatting={applyExperimentToContentFormatting(step.contentFormatting, experiment, stepID)}
                        stepID={stepID}
                    />
                </div>)}
            </GridLayout>
            {<style jsx global>{`
                .${styles.GridLayoutWrapper} .textAlign-center .public-DraftStyleDefault-ltr {
                    text-align: center
                }
            `}</style>}
        </div> : null}
    </div>
}


const BoxBody = ({ content, response, checkResponse, setResponse, contentFormatting, stepID }) => {
    if (!content)
        return null

    var formatting = {...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {})}
    if (content.name === 'Check answer'){
        return <div style={formatting}><button
          type="button" onClick={checkResponse}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {content.name}
        </button></div>
    } else if (content.name.startsWith('Response')){
        return <div>{content.body && content.body.map((responseItem, i) => {
            var responseItemFormatting = {...(contentFormatting && contentFormatting[responseItem.id] ? contentFormatting[responseItem.id] : {})}
            if (responseItem.kind === 'responsespace')
                return <ResponseSpace key={i}
                    responseItem={responseItem} setResponse={setResponse}
                    response={response && response[responseItem.id]}
                    formatting={responseItemFormatting}
                    stepID={stepID}
                />
            else
                return <span key={i} style={responseItemFormatting}><Editor editorState={responseItem.body ? EditorState.createWithContent(convertFromRaw(responseItem.body)) : EditorState.createEmpty()} readOnly={true} /></span>
        })}</div>
    } else {
        return <div style={formatting}>
            <Editor
                blockStyleFn={blockStyleFn.bind(this, formatting)}
                editorState={EditorState.createWithContent(convertFromRaw(content.body))}
                readOnly={true}
            />
        </div>
    }

    return <div>{content.name}</div>
}



const ResponseSpace = ({ setResponse, responseItem, response, formatting, stepID }) => {
    const router = useRouter()
    const inputRef = useRef()

    useEffect(() => {
        if (response){
            inputRef.current.value = response;
        } else {
            inputRef.current.value = '';
        }
    }, [stepID])

    return <input type='text' ref={inputRef}
        className={"shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md" + (formatting.display === 'inline-block' ? '' : ' block w-full')}
        onChange={(event) => setResponse(responseItem.id, event.target.value) }
    />
}
