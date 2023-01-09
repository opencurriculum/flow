import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef, Fragment, useContext} from 'react'
import {
    collection, getDocs, getDoc, doc, updateDoc, setDoc, arrayUnion,
    increment, Timestamp, documentId, query, where
} from "firebase/firestore"
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import {UserAppHeader} from '../../../../[appid].tsx'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import update from 'immutability-helper'
import Head from 'next/head'
import { useFirestore, useAnalytics } from 'reactfire'
import { StepItem } from '../../../../../../components/step-item.tsx'
import { getOrInitializeFlowExperiment } from '../../../../../../utils/experimentation.tsx'
import { updateFlowProgressStateUponStepCompletion, StepContentTypes, LoadingSpinner } from '../../../../../../utils/common'
import { UserContext } from '../../../../../_app'


const Step = ({}) => {
    const [flow, setFlow] = useState()
    const [step, setStep] = useState(null)
    const [progress, setProgress] = useState()
    const [flowSteps, setFlowSteps] = useState()

    const [openResponseCheckResult, setOpenResponseCheckResult] = useState(false)

    const [experiment, setExperiment] = useState()

    const router = useRouter(),
        db = useFirestore()
    var analytics

    const [user, userID] = useContext(UserContext)
    // try {
    //     analytics = useAnalytics()
    // } catch (e){
    //     console.log(e)
    // }

    useEffect(() => {
        if (router.query.flowid && userID){
            var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)

            getDoc(flowProgressRef).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setProgress(docSnapshot.data())
                } else {
                    setDoc(flowProgressRef, { completed: 0, steps: {} })
                    setProgress({ completed: 0, steps: {} })
                }
            })

            getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                var flowSteps = []
                docsSnapshot.forEach(doc => flowSteps.push({ id: doc.id, ...doc.data() }))
                setFlowSteps(flowSteps.sort((a, b) => a.position - b.position))
            })

            // if (analytics && process.env.NODE_ENV === 'production'){
            //     logEvent(app.analytics, 'screen_view', {
            //       firebase_screen: 'step',
            //     })
            //
            //     logEvent(app.analytics, 'step_shown', { stepID: router.query.stepid });
            // }
        }
    }, [router.query.flowid, userID])

    useEffect(() => {
        if (router.query.flowid && userID){
            getOrInitializeFlowExperiment(db, router.query.flowid, userID, router.query.group, setExperiment)

            getDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid)).then(docSnapshot => {
                setStep(docSnapshot.data())
            })
        }
    }, [router.query.stepid, userID])

    useEffect(() => {
        if (flow && !(flow.progress && flow.progress[userID])){
            updateDoc(doc(db, "flows", router.query.flowid), {
                [`progress.${userID}.name`]: user.displayName || `Anonymous ${userID.substring(0, 5)}`
            })
        }

        if (flow && !(flow.progress && flow.progress[userID] && flow.progress.steps && flow.progress.steps[router.query.stepid] && flow.progress.steps[router.query.stepid].hasOwnProperty('completed'))){
            updateDoc(doc(db, "flows", router.query.flowid), {
                [`progress.${userID}.steps.${router.query.stepid}.completed`]: 0
            })
        }
    }, [flow])

    useEffect(() => {
        if (progress){
            if (!(progress.steps && progress.steps[router.query.stepid] && progress.steps[router.query.stepid].hasOwnProperty('completed'))){
                updateDoc(doc(db, "users", userID, 'progress', router.query.flowid), {
                    [`steps.${router.query.stepid}.attempts`]: [],
                    [`steps.${router.query.stepid}.completed`]: 0
                })
            }
        }
    }, [progress, router.query.stepid, router.query.flowid])

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                setFlow(docSnapshot.data())
            })
        }
    }, [router.query.flowid])

    var searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()

    var submitScore = function(score){
        fetch(`/api/lti/submit-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ltik: router.query.ltik,
                lineItemId: router.query.lineItemId,
                userID: router.query.userID,
                score
            }),
        })
    }

    return <div className='funky'>
        <Head>
            <title>{(step && step.name) || 'Untitled step'}</title>
            <meta property="og:title" content={(step && step.name) || 'Untitled step'} key="title" />
        </Head>

        <UserAppHeader db={db} hideBack={flow && flow.assignStepsIndividually ? true : (progress && !progress.completed)} />

        {step ? <div>
            <StepItem
                userID={userID} step={step} stepID={router.query.stepid}
                progress={progress} flowSteps={flowSteps} experiment={experiment}
                onResponseAssess={(success) => {
                    if (success){
                        updateFlowProgressStateUponStepCompletion(router.query.stepid, progress, setProgress, flowSteps.length)

                        setOpenResponseCheckResult({ status: 1, title: 'That\'s correct!', message: 'Good work.' })

                        if (!flow.assignStepsIndividually){
                            setTimeout(() => {
                                // Get the next step and move to it.
                                var indexOfCurrentStep = flowSteps.findIndex(step => step.id === router.query.stepid)

                                if (indexOfCurrentStep === flowSteps.length - 1){
                                    setOpenResponseCheckResult({ status: 2, title: 'You are all wrapped up with this level!', message: 'Great job!' })

                                } else {
                                    setOpenResponseCheckResult(false)
                                    router.push(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${flowSteps[indexOfCurrentStep + 1].id}${window.location.search}`)
                                }
                            }, 2000)
                        }

                    } else {
                        setOpenResponseCheckResult({ status: 0, title: 'That\'s not quite right', message: 'Try again!' })
                        setTimeout(() => setOpenResponseCheckResult(false), 2000)
                    }
                }}
                contentTypes={StepContentTypes}
            />

            {searchParams.has('ltik') ? <button
              type="button" onClick={() => {
                  // Determine what the resource is and gather progress to submit.
                  var ltiResourceParts = searchParams.get('ltiResource').split('/'),
                    finalScore = 0

                  if (ltiResourceParts.length <= 3){
                      // Fetch all flow IDs and their progress.
                      getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                          var appData = docSnapshot.data()

                          if (appData.flows){
                              // var appProgressRef = query(collection(db, "users", userID, "progress"), where(documentId(), 'in', appData.flows))
                              getFlowsProgress(db, userID, appData.flows).then(docsSnapshot => {
                                  var flowsProgress = {}
                                  docsSnapshot.forEach(doc => {
                                      var stepID, stepProgress = doc.steps
                                      for (stepID in stepProgress){
                                          finalScore += (
                                              stepProgress.hasOwnProperty(stepID) && stepProgress[stepID].completed ? 10 : 0)
                                      }
                                  })

                                  submitScore(finalScore)
                              })
                          }
                      })

                  } else {
                      if (ltiResourceParts.length <= 5){
                          var stepID
                          for (stepID in progress.steps){
                              finalScore += (
                                 progress.steps.hasOwnProperty(stepID) && progress.steps[stepID].completed ? 10 : 0)
                          }

                      } else {
                          finalScore += (
                              progress.steps.hasOwnProperty(ltiResourceParts[6]) && progress.steps[ltiResourceParts[6]].completed ? 10 : 0)
                      }
                  }

                  submitScore(finalScore)
              }}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Finish and submit
            </button> : null}
        </div>: <div className='py-10'>
            <LoadingSpinner />
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


export default Step
