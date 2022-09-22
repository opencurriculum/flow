import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import {
    collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc,
    getCollection, documentId, arrayUnion, writeBatch, deleteDoc
} from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import update from 'immutability-helper'
import { getAppFlows } from '../../../utils/store'
import { useFirestore } from 'reactfire'


const UserApp: NextPage = ({ userID }: AppProps) => {
    var [app, setApp] = useState()
    var [flows, setFlows] = useState()

    var nameRef = useRef(),
        allowStepsListingRef = useRef(),
        stepsAliasRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.appid){
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
                    allowStepsListingRef.current.checked = appData.allowStepsListing || false
                    stepsAliasRef.current.value = appData.stepsAlias || ''

                    if (appData.flows){
                        getAppFlows(db, appData.flows).then(
                            unsortedFlows => setFlows(unsortedFlows.sort((a, b) => appData.flows.indexOf(a.id) - appData.flows.indexOf(b.id)))
                        )
                    }
                })
            }
        }
    }, [router.query.appid])

    return <div>
        <a href={`/app/${router.query.appid}`} target="_blank" rel="noreferrer">Preview</a>

        <button onClick={() => {
            router.push(`/admin/app/${router.query.appid}/flow/new`)
        }}>Add a flow</button>

        Flows
        {flows ? <ul>{flows.map((flow, i) => <Flow
            key={i}
            flow={flow}
            deleteFlow={flowID => {
                setFlows(flows => update(flows, {
                    $splice: [[flows.findIndex(f => f.id === flowID), 1]]
                }))

                getDocs(collection(db, "flows", flowID, 'steps')).then(docsSnapshot => {
                    const batch = writeBatch(db)
                    docsSnapshot.forEach(docSnapshot => deleteDoc(doc(db, "flows", flowID, 'steps', docSnapshot.id)))
                    deleteDoc(doc(db, "flows", flowID))
                    batch.commit()
                })
            }}
        />)}</ul>: null}

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

          <div className="relative flex items-start">
            <div className="flex h-5 items-center">
              <input
                ref={allowStepsListingRef}
                aria-describedby="allowStepsListing-description"
                name="allowStepsListing"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                onChange={(event) => updateDoc(doc(db, "apps", router.query.appid), { allowStepsListing: event.target.checked })}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="comments" className="font-medium text-gray-700">
                Allow students to see prior steps in a flow
              </label>
              <p id="comments-description" className="text-gray-500">
                This will allow them to review and jump to a step they have already responded to.
              </p>
            </div>
          </div>

          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            What do you call steps in your app?
          </label>
          <div className="mt-1">
            <input
              ref={stepsAliasRef}
              type="text"
              name="name"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="E.g., problems, items, questions"
              onBlur={(event) => {
                  if (event.target.value.length)
                    updateDoc(doc(db, "apps", router.query.appid), { stepsAlias: event.target.value })
              }}
            />
          </div>
        </div>
    </div>
}


const Flow = ({ flow, deleteFlow }) => {
    const router = useRouter()
    return <li>
        <Link href={{
            pathname: '/admin/app/[appid]/flow/[flowid]',
            query: { appid: router.query.appid, flowid: flow.id }
        }}><a>{flow.name}</a></Link>
        <Link href={{
            pathname: '/admin/app/[appid]/flow/[flowid]',
            query: { appid: router.query.appid, flowid: router.query.flowid, flowid: 'new', duplicate: flow.id }
        }}><a>(Duplicate)</a></Link>
        <a onClick={() => {
            if (window.confirm('Are you sure you want to delete ' + flow.id + '?')){
                deleteFlow(flow.id)
            }
        }}>Delete...</a>
    </li>
}


export default UserApp
