import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, getCollection } from "firebase/firestore"
import { useRouter } from 'next/router'
import Head from 'next/head'
import {UserAppHeader} from '../../[appid].tsx'
import Link from 'next/link'
import {t} from '../../../../utils/common.tsx'


const FlowWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.flowid)
        return null

    return <div>
        <Flow db={app.db} userID={userID} />
    </div>
}


const Flow: NextPage = ({ db, userID }: AppProps) => {
    var [flow, setFlow] = useState()
    var [progress, setProgress] = useState()
    var [steps, setSteps] = useState()
    var [app, setApp] = useState()

    const router = useRouter()

    useEffect(() => {
        getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
            var appData = docSnapshot.data()
            setApp(appData)
        })
    }, [db])

    useEffect(() => {
        var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
        getDoc(flowProgressRef).then(docSnapshot => {
            if (!docSnapshot.exists()){
                setDoc(flowProgressRef, { completed: 0 })
                setProgress({ completed: 0 })
            } else {
                setProgress(docSnapshot.data())
            }
        })

        getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
            var unsortedSteps = []
            docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))
            setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
        })
    }, [])

    useEffect(() => {
        if (steps && progress && app){
            if (!app.allowStepsListing || !progress.completed){
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
    }, [steps, progress, app])

    useEffect(() => {
        getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
            setFlow(docSnapshot.data())
        })
    }, [router.query.flowid])


    return <div>
        <Head>
            <title>{flow && flow.name}</title>
            <meta property="og:title" content={flow && flow.name} key="title" />
        </Head>

        <UserAppHeader db={db} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-4 w-3/12">
            {steps && progress ? <ul role="list" className="space-y-4">
                {steps.map((step, i) => <li key={i} className={"bg-white shadow overflow-hidden rounded-md text-center" + (!progress.steps[step.id] ? ' opacity-30' : '')}>
                    <Link href={{
                        pathname: '/app/[appid]/flow/[flowid]/step/[stepid]' + window.location.search,
                        query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id }
                    }}><a className='px-6 py-4 block'>
                        <div>{step.name || `${t('Step', app)} ${i + 1}`}</div>
                    </a></Link>
                </li>)}
            </ul> : null}
        </div>
    </div>
}

export default FlowWrapper
