import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useContext} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, getCollection } from "firebase/firestore"
import { useRouter } from 'next/router'
import Head from 'next/head'
import {UserAppHeader} from '../../[appid].tsx'
import Link from 'next/link'
import {t, updateFlowProgressStateUponStepCompletion} from '../../../../utils/common.tsx'
import { useFirestore } from 'reactfire'
import { StepItem } from '../../../../components/step-item.tsx'
import { getOrInitializeFlowExperiment } from '../../../../utils/experimentation.tsx'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import GridContainer from '../../../../components/grid-container.tsx'
import { UserContext } from '../../../_app'


const Flow: NextPage = ({}: AppProps) => {
    var [flow, setFlow] = useState()
    var [progress, setProgress] = useState()
    var [steps, setSteps] = useState()
    var [app, setApp] = useState()
    const [experiment, setExperiment] = useState()
    const [user, userID] = useContext(UserContext)

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.appid){
            getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                var appData = docSnapshot.data()
                setApp(appData)
            })
        }
    }, [router.query.appid])

    useEffect(() => {
        if (router.query.flowid && userID){
            var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
            getDoc(flowProgressRef).then(docSnapshot => {
                if (!docSnapshot.exists()){
                    setDoc(flowProgressRef, { completed: 0, steps: {} })
                    setProgress({ completed: 0, steps: {} })
                } else {
                    setProgress(docSnapshot.data())
                }
            })

            getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                var unsortedSteps = []
                docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))
                setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
            })


            getOrInitializeFlowExperiment(db, router.query.flowid, userID, router.query.group, setExperiment)
        }
    }, [router.query.flowid, userID])

    useEffect(() => {
        if (flow && steps && progress && app){
            if (!flow.singlePageFlow && (!app.allowStepsListing || !progress.completed)){
                var stepProgress
                steps.find((step, i) => {
                    // First, check the progress this has made.
                    stepProgress = progress.steps && progress.steps[step.id] ? (
                        progress.steps[step.id].completed) : 0

                    // If the progress is less than 100, or this is last one, stop at this.
                    if (stepProgress < 100 || (i === steps.length - 1)){
                        // Redirect to this step.
                        router.replace(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${step.id}${window.location.search}`)
                        return true
                    }
                })
            }
        }
    }, [flow, steps, progress, app])

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                setFlow(docSnapshot.data())
            })
        }
    }, [router.query.flowid])

    return <div>
        <Head>
            <title>{flow && flow.name}</title>
            <meta property="og:title" content={flow && flow.name} key="title" />
        </Head>

        <UserAppHeader db={db} />

        {steps && progress ? (flow.singlePageFlow ? <div>
            {flow.header ? <GridContainer {...flow.header} /> : null}

            {steps.map((step, i) => <FlowStepItem step={step} key={i}
                userID={userID} progress={progress} setProgress={setProgress} steps={steps} experiment={experiment}
                onComplete={() => {
                    // Get the next step and move to it.
                    var indexOfCurrentStep = steps.findIndex(s => s.id === step.id)

                    if (indexOfCurrentStep === steps.length - 1){
                        alert('You are all wrapped up with this level! Great job.')
                    }
                }}
            />)}
            </div> : <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-4 w-3/12"><ul role="list" className="space-y-4">
                {steps.map((step, i) => <li key={i} className={"bg-white shadow overflow-hidden rounded-md text-center" + (!(progress && progress.steps && progress.steps[step.id]) ? ' opacity-30' : '')}>
                    <Link href={{
                        pathname: '/app/[appid]/flow/[flowid]/step/[stepid]' + window.location.search,
                        query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id }
                    }}><a className='px-6 py-4 block'>
                        <div>{step.name || `${t('Step', app)} ${i + 1}`}</div>
                    </a></Link>
                </li>)}
            </ul></div>
        ): null}

    </div>
}


const FlowStepItem = ({ step, userID, progress, setProgress, steps, experiment, onComplete }) => {
    var [responseStatus, setResponseStatus] = useState(
        progress && progress.steps && progress.steps[step.id] ? (progress.steps[step.id].completed === 100 ? { status: 1 } : undefined) : undefined)

    return <div className='flex py-6 m-6 border-b border-gray-200'>
        <div className='flex-grow'>
            <StepItem userID={userID} step={step} stepID={step.id}
                progress={progress} flowSteps={steps}
                experiment={experiment}
                onResponseAssess={(success) => {
                    if (success){
                        updateFlowProgressStateUponStepCompletion(step.id, progress, setProgress, steps.length)

                        setResponseStatus({ status: 1, title: 'That\'s correct!', message: 'Good work.' })

                        onComplete()

                    } else {
                        setResponseStatus({ status: 0, title: 'That\'s not quite right', message: 'Try again!' })
                    }
                }}

            />
        </div>
        <div className='w-20'>{responseStatus ? (responseStatus.status === 1 ? <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div> : <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <XMarkIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>) : null}</div>
    </div>
}


export default Flow
