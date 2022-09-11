import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect} from 'react'
import { collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, documentId } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { Disclosure } from '@headlessui/react'
import { ReactFitty } from "../../utils/react-fitty"
import { usePopper } from 'react-popper'
import { Popover } from '@headlessui/react'
import { ChevronLeftIcon } from '@heroicons/react/24/solid'


export const UserAppHeader = ({ db }) => {
    var [app, setApp] = useState()
    var [appOwner, setAppOwner] = useState()
    const router = useRouter()

    useEffect(() => {
        getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
            var appData = docSnapshot.data()
            setApp(appData)

            getDoc(appData.owner).then(docSnapshot => {
                setAppOwner(docSnapshot.data())
            })
        })
    }, [db])

    return <div className="min-h-full">
      <Disclosure as="nav" className="bg-white shadow-sm">
        {({ open }) => (
          <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex">
                  <div className="flex-shrink-0 flex items-center">
                    <Link href={`/app/${router.query.appid}`}><a className="text-2xl font-bold">{app && app.name}</a></Link>
                  </div>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:items-center">
                  <a
                    href={appOwner && appOwner.website || null}
                    type="button"
                    className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    {appOwner ? <span>By {appOwner.name}</span> : null}
                  </a>
                </div>
              </div>
            </div>
          </>
        )}
      </Disclosure>
      <div className="py-4">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            {router.query.flowid ? <button
                type="button"
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                 onClick={() => router.back()}
              >
                  <ChevronLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Back
              </button> : null}
          </div>
      </div>
    </div>
}


const UserAppWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.appid)
        return null

    return <div>
        <UserApp db={app.db} userID={userID} />
    </div>
}


const UserApp: NextPage = ({ db, userID }: AppProps) => {
    var [progress, setProgress] = useState()
    var [app, setApp] = useState()
    var [flows, setFlows] = useState()
    const router = useRouter()

    useEffect(() => {
        getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
            var appData = docSnapshot.data()
            setApp(appData)

            if (appData.flows){
                getDocs(query(collection(db, "flows"), where(documentId(), 'in', appData.flows))).then(docsSnapshot => {
                    var unsortedFlows = []
                    docsSnapshot.forEach(doc => unsortedFlows.push({ id: doc.id, ...doc.data() }))
                    setFlows(unsortedFlows.sort((a, b) => appData.flows.indexOf(a.id) - appData.flows.indexOf(b.id)))
                })

                var userRef = doc(db, "users", userID)
                getDoc(userRef).then(docSnapshot => {
                    if (docSnapshot.exists()){
                        var appProgressRef = query(collection(db, "users", userID, 'progress'), where(documentId(), 'in', appData.flows))
                        getDocs(appProgressRef).then(docsSnapshot => {
                            var flowsProgress = {}
                            docsSnapshot.forEach(doc => flowsProgress[doc.id] = doc.data().completed)
                            setProgress(flowsProgress)
                        })
                    } else {
                        setDoc(userRef, { name: 'Someone something' })
                        setProgress({})
                    }
                })
            }
        })
    }, [])

    return <div>
        <UserAppHeader db={db} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-4 w-3/12">
            {flows && progress ? <ul role="list" className="space-y-10">
                {flows.map((flow, i) => <li key={i} className={"bg-white shadow overflow-hidden rounded-md text-center" + (progress[flow.id] === 100 ? ' opacity-30' : '')}>
                    <Link href={{
                        pathname: '/app/[appid]/flow/[flowid]' + window.location.search,
                        query: { appid: router.query.appid, flowid: flow.id }
                    }}><a className='px-6 py-4 block'>
                        <div><ReactFitty maxSize={96} minSize={12} wrapText={true}>{flow.name}</ReactFitty></div>

                        {progress[flow.id] ? <ProgressIndicator progress={progress[flow.id]} /> : null}
                    </a></Link>
                </li>)}
            </ul> : null}
        </div>
    </div>
}


const ProgressIndicator = ({ progress }) => {
    const [isShowingTip, setIsShowingTip] = useState(false)
    let [referenceElement, setReferenceElement] = useState()
    let [popperElement, setPopperElement] = useState()
    let { styles, attributes } = usePopper(referenceElement, popperElement, {
        placement: 'top'
    })

    return <Popover className="relative z-10">
        {({open}) => (
            <>
                <Popover.Button ref={setReferenceElement} className='w-full'>
                    <div onMouseEnter={() => setIsShowingTip(true)} onMouseLeave={() => setIsShowingTip(false)}>
                        <div className='border rounded'>
                            <div className='bg-teal-400 h-6' style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                </Popover.Button>
                {isShowingTip && <Popover.Panel className="p-2 bg-slate-700 text-sm text-white font-bold rounded" static ref={setPopperElement}
                    style={styles.popper}
                    {...attributes.popper}
                >
                    <div>{progress}% completed</div>
                </Popover.Panel>}
            </>
        )}
    </Popover>
}


export default UserAppWrapper
