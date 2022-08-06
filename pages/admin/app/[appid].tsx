import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, documentId, arrayUnion } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'


const UserAppWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.appid)
        return null

    return <div>
        <UserApp db={app.db} userID={userID} />
    </div>
}


const UserApp: NextPage = ({ db, userID }: AppProps) => {
    var [app, setApp] = useState()
    var [flows, setFlows] = useState()

    var nameRef = useRef()

    const router = useRouter()

    useEffect(() => {
        if (router.query.appid === 'new'){
            var newAppID = uuidv4().substring(0, 8)
            setDoc(doc(db, "apps", newAppID), { name: 'Untitled learning app', owner: doc(db, "users", userID) }).then(() => {
                updateDoc(doc(db, "users", userID), { apps: arrayUnion(newAppID) }).then(() => {
                    router.replace(`/admin/app/${newAppID}`)
                })
            })
        } else {
            getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                var appData = docSnapshot.data()

                setApp(appData)
                nameRef.current.value = appData.name || ''

                if (appData.flows){
                    getDocs(query(collection(db, "flows"), where(documentId(), 'in', appData.flows))).then(docsSnapshot => {
                        var unsortedFlows = []
                        docsSnapshot.forEach(doc => unsortedFlows.push({ id: doc.id, ...doc.data() }))
                        setFlows(unsortedFlows.sort((a, b) => appData.flows.indexOf(a.id) - appData.flows.indexOf(b.id)))
                    })
                }
            })
        }
    }, [router.query.appid])

    return <div>
        <button onClick={() => {
            router.push(`/admin/app/${router.query.appid}/flow/new`)
        }}>Add a flow</button>

        Flows
        {flows ? <ul>{flows.map((flow, i) => <li key={i}><Link href={{
            pathname: '/admin/app/[appid]/flow/[flowid]',
            query: { appid: router.query.appid, flowid: flow.id }
        }}><a>{flow.name}</a></Link></li>)}</ul> : null}

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
              placeholder="App name"
              onBlur={(event) => updateDoc(doc(db, "apps", router.query.appid), { name: event.target.value })}
            />
          </div>
        </div>
    </div>
}


export default UserAppWrapper
