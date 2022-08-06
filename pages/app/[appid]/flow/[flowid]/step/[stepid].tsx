import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, arrayUnion, increment } from "firebase/firestore"
import 'react-grid-layout/css/styles.css'
import GridLayout from "react-grid-layout"
import {Editor, EditorState, ContentState, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import {UserAppHeader} from '../../../../[appid].tsx'
import {blockStyleFn} from '../../../../../../utils/common.tsx'
import styles from '../../../../../../styles/components/StepAdmin.module.sass'


const StepWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (app && app.analytics && process.env.NODE_ENV === 'production'){
        logEvent(app.analytics, 'screen_view', {
          firebase_screen: 'step',
        })

        logEvent(app.analytics, 'step_shown', { stepID: router.query.stepid });
    }

    if (!(app && app.db))
        return null

    if (!router.query.stepid)
        return null

    return <div>
        <Step db={app.db} userID={userID} />
    </div>
}


const Step = ({ db, userID }) => {
    const [step, setStep] = useState(null)
    const [response, setResponse] = useState({})
    const [progress, setProgress] = useState()
    const [flowSteps, setFlowSteps] = useState()

    const router = useRouter()

    var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
    useEffect(() => {
        getDoc(flowProgressRef).then(docSnapshot => {
            if (docSnapshot.exists()){
                setProgress(docSnapshot.data())
            } else {
                setDoc(flowProgressRef, { completed: 0, steps: {} })
            }
        })

        getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
            var flowSteps = []
            docsSnapshot.forEach(doc => flowSteps.push({ id: doc.id, ...doc.data() }))
            setFlowSteps(flowSteps.sort((a, b) => a.position - b.position))
        })
    }, [])

    useEffect(() => {
        getDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid)).then(docSnapshot => {
            setStep(docSnapshot.data())
        })
    }, [router.query.stepid])

    useEffect(() => {
        if (progress){
            if (!(progress.steps && progress.steps[router.query.stepid] && progress.steps[router.query.stepid].hasOwnProperty('completed'))){
                updateDoc(flowProgressRef, {
                    [`steps.${router.query.stepid}.attempts`]: [],
                    [`steps.${router.query.stepid}.completed`]: 0
                })
            }
        }
    }, [progress, router.query.stepid])


    var layout = step ? JSON.parse(step.layout) : null,
        layoutContent = step ? JSON.parse(step.layoutContent) : null

    return <div>
        <UserAppHeader db={db} />
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
                        let variableDeclations = []
                        for (var prop in response[router.query.stepid]){
                            variableDeclations.push(`${prop} = ${response[router.query.stepid][prop]}`)
                        }
                        if (Function(`'use strict'; var ${variableDeclations.join(',')}; return (${step.responseCheck})`)()){
                            updateDoc(flowProgressRef, {
                                [`steps.${router.query.stepid}.attempts`]: arrayUnion(response),
                                [`steps.${router.query.stepid}.completed`]: 100,
                                completed: increment(
                                    (progress.steps && progress.steps[router.query.stepid] && progress.steps[router.query.stepid].completed) === 100 ? 0 : (100 / flowSteps.length)
                                )
                            })
                            setProgress({
                                ...progress, completed: progress.completed + 100 / flowSteps.length,
                                steps: {
                                    ...(progress.steps || {}),
                                    [router.query.stepid]: {
                                        ...((progress.steps && progress.steps[router.query.stepid]) || {}),
                                        completed: 100
                                    }
                                }
                            })

                            alert('That\'s correct! Good work.')

                            // Get the next step and move to it.
                            var indexOfCurrentStep = flowSteps.findIndex(step => step.id === router.query.stepid)

                            if (indexOfCurrentStep === flowSteps.length - 1){
                                alert('You are all wrapped up with this level!')
                                router.push(`/app/${router.query.appid}`)

                            } else {
                                router.push(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${flowSteps[indexOfCurrentStep + 1].id}`)
                            }

                        } else {
                            alert('That\'s not right. Try again!')
                            updateDoc(flowProgressRef, {
                                [`steps.${router.query.stepid}.attempts`]: arrayUnion(response),
                            })
                        }
                    }}
                    response={response}
                    setResponse={(id, value) => {
                        setResponse({ ...response, [router.query.stepid]: {
                            ...(response[router.query.stepid] ? response[router.query.stepid] : {}), [id]: value }
                        })
                    }}
                    contentFormatting={step.contentFormatting}
                />
            </div>)}
        </GridLayout>
        {<style jsx global>{`
            .${styles.GridLayoutWrapper} .textAlign-center .public-DraftStyleDefault-ltr {
                text-align: center
            }
        `}</style>}
        </div>: <div className='py-10'>
            <svg className="animate-spin h-5 w-5 text-black mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        </div>}
    </div>
}


const BoxBody = ({ content, response, checkResponse, setResponse, contentFormatting }) => {
    const router = useRouter()

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
        return <div>{content.body.map((responseItem, i) => {
            if (responseItem.kind === 'responsespace')
                return <ResponseSpace key={i} responseItem={responseItem} setResponse={setResponse} response={response[router.query.stepid] && response[router.query.stepid][responseItem.id]} />
            else
                return <span key={i}><Editor editorState={responseItem.body ? EditorState.createWithContent(convertFromRaw(responseItem.body)) : EditorState.createEmpty()} readOnly={true} /></span>
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


const ResponseSpace = ({ setResponse, responseItem, response }) => {
    const router = useRouter()
    const inputRef = useRef()

    useEffect(() => {
        if (response){
            inputRef.current.value = response;
        } else {
            inputRef.current.value = '';
        }
    }, [router.query.stepid])

    return <input type='text' ref={inputRef} className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full border-gray-300 rounded-md" onChange={(event) => setResponse(responseItem.id, event.target.value) } />
}


export default StepWrapper
