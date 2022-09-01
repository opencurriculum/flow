import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef, Fragment} from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, arrayUnion, increment, Timestamp } from "firebase/firestore"
import 'react-grid-layout/css/styles.css'
import GridLayout from "react-grid-layout"
import {Editor, EditorState, ContentState, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import {UserAppHeader} from '../../../../[appid].tsx'
import {blockStyleFn} from '../../../../../../utils/common.tsx'
import styles from '../../../../../../styles/components/StepAdmin.module.sass'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import update from 'immutability-helper'


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

    const [openResponseCheckResult, setOpenResponseCheckResult] = useState(false)

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

    // Merge the response and progress.
    var lastUserResponse = response[router.query.stepid]

    var stepProgress = progress && progress.steps[router.query.stepid]
    if (stepProgress){
        var lastAttempt = stepProgress.attempts[stepProgress.attempts.length - 1]

        if (lastAttempt){
            lastUserResponse = lastAttempt.response
        }
    }

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
                        var currentAnswer = (response[router.query.stepid] || stepProgress)

                        if (currentAnswer){
                            let variableDeclations = []
                            for (var prop in currentAnswer){
                                variableDeclations.push(`${prop} = ${currentAnswer[prop]}`)
                            }
                            if (Function(`'use strict'; var ${variableDeclations.join(',')}; return (${step.responseCheck})`)()){
                                updateDoc(flowProgressRef, {
                                    [`steps.${router.query.stepid}.attempts`]: arrayUnion({
                                        timestamp: Timestamp.now(), response: currentAnswer
                                    }),
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

                                setOpenResponseCheckResult({ status: 1, title: 'That\'s correct!', message: 'Good work.' })

                                setTimeout(() => {
                                    // Get the next step and move to it.
                                    var indexOfCurrentStep = flowSteps.findIndex(step => step.id === router.query.stepid)

                                    if (indexOfCurrentStep === flowSteps.length - 1){
                                        setOpenResponseCheckResult({ status: 2, title: 'You are all wrapped up with this level!', message: 'Great job!' })

                                    } else {
                                        setOpenResponseCheckResult(false)
                                        router.push(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${flowSteps[indexOfCurrentStep + 1].id}`)
                                    }
                                }, 2000)


                            } else {
                                setOpenResponseCheckResult({ status: 0, title: 'That\'s not quite right', message: 'Try again!' })
                                setTimeout(() => setOpenResponseCheckResult(false), 2000)

                                updateDoc(flowProgressRef, {
                                    [`steps.${router.query.stepid}.attempts`]: arrayUnion({
                                        timestamp: Timestamp.now(), response: currentAnswer
                                    }),
                                })
                            }
                        }

                    }}
                    response={lastUserResponse}
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

        <Transition.Root show={openResponseCheckResult ? true : false} as={Fragment}>
          <Dialog as="div" className="relative z-10" onClose={setOpenResponseCheckResult}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6">
                      <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
                        <button
                          type="button"
                          className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                          onClick={() => setOpenResponseCheckResult(false)}
                        >
                          <span className="sr-only">Close</span>
                          <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                        </button>
                      </div>

                      <div>
                        <div className={"mx-auto flex h-12 w-12 items-center justify-center rounded-full " + (openResponseCheckResult && openResponseCheckResult.status ? "bg-green-100" : "bg-red-100")}>
                          {openResponseCheckResult && openResponseCheckResult.status ? <CheckIcon className="h-6 w-6 text-green-600" aria-hidden="true" /> : <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />}
                        </div>
                        <div className="mt-3 text-center sm:mt-5">
                          <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                            {openResponseCheckResult && openResponseCheckResult.title}
                          </Dialog.Title>
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              {openResponseCheckResult && openResponseCheckResult.message}
                            </p>
                          </div>
                        </div>
                      </div>

                    {openResponseCheckResult && openResponseCheckResult.status === 2 ? <div className="mt-5 sm:mt-6">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:text-sm"
                        onClick={() => {
                            setOpenResponseCheckResult(false)
                            router.push(`/app/${router.query.appid}`)
                        }}
                      >
                        Okay
                      </button>
                    </div> : null}

                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>

    </div>
}


const BoxBody = ({ content, response, checkResponse, setResponse, contentFormatting }) => {
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
            var responseItemFormatting = {...(contentFormatting && contentFormatting[responseItem.id] ? contentFormatting[responseItem.id] : {})}
            if (responseItem.kind === 'responsespace')
                return <ResponseSpace key={i}
                    responseItem={responseItem} setResponse={setResponse}
                    response={response && response[responseItem.id]}
                    formatting={responseItemFormatting}
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


const ResponseSpace = ({ setResponse, responseItem, response, formatting }) => {
    const router = useRouter()
    const inputRef = useRef()

    useEffect(() => {
        if (response){
            inputRef.current.value = response;
        } else {
            inputRef.current.value = '';
        }
    }, [router.query.stepid])

    return <input type='text' ref={inputRef}
        className={"shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md" + (formatting.display === 'inline-block' ? '' : ' block w-full')}
        onChange={(event) => setResponse(responseItem.id, event.target.value) }
    />
}


export default StepWrapper
