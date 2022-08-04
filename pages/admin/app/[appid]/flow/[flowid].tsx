import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, arrayUnion } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'


const FlowWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.flowid)
        return null

    return <div>
        <Flow db={app.db} userID={userID} />
    </div>
}


const Flow: NextPage = ({ db, userID }: AppProps) => {
    var [steps, setSteps] = useState()
    const router = useRouter()

    useEffect(() => {
        if (router.query.flowid === 'new'){
            var newFlowID = uuidv4().substring(0, 8)
            setDoc(doc(db, "flows", newFlowID), { name: 'Untitled flow' }).then(() => {
                updateDoc(doc(db, "apps", router.query.appid), { flows: arrayUnion(newFlowID) }).then(() => {
                    router.replace(`/admin/app/${router.query.appid}/flow/${newFlowID}`)
                })
            })

        } else {
            getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                var unsortedSteps = []
                docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))
                setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
            })
        }
    }, [])

    return <div>
        <button onClick={() => {
            router.push(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/new`)
        }}>Add a step</button>
        Steps
        {steps ? <ul>{steps.map((step, i) => <li key={i}>
            <Link href={{
                pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
                query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id }
            }}><a>{step.id}</a></Link>
            <Link href={{
                pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
                query: { appid: router.query.appid, flowid: router.query.flowid, stepid: 'new', duplicate: step.id }
            }}><a>(Duplicate)</a></Link>
        </li>)}</ul> : null}
    </div>
}

export default FlowWrapper
