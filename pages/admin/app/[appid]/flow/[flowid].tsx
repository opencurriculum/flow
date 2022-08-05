import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
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
    var [flow, setFlow] = useState()
    var [steps, setSteps] = useState()
    var nameRef = useRef()

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
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                var flowData = docSnapshot.data()

                setFlow(flowData)
                nameRef.current.value = flowData.name || ''

                getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                    var unsortedSteps = []
                    docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))
                    setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
                })
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

        <div className='max-w-xs mx-auto'>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <div className="mt-1">
            <input
              ref={nameRef}
              type="text"
              name="name"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Flow name"
              onBlur={(event) => updateDoc(doc(db, "flows", router.query.flowid), { name: event.target.value })}
            />
          </div>
        </div>

    </div>
}

export default FlowWrapper
