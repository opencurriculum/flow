import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect} from 'react'
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

                if (appData.flows){
                    getDocs(query(collection(db, "flows"), where(documentId(), 'in', appData.flows))).then(docsSnapshot => {
                        var unsortedFlows = []
                        docsSnapshot.forEach(doc => unsortedFlows.push({ id: doc.id, ...doc.data() }))
                        setFlows(unsortedFlows.sort(flow => app.flows.indexOf(flow.id)))
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

    </div>
}


export default UserAppWrapper
