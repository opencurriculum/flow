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
import Layout, { TabbedPageLayout } from '../../../components/admin-layout'
import type { NextPageWithLayout } from '../_app'
import { Menu, Transition, Dialog } from '@headlessui/react'
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid'
import { Fragment } from 'react'
import { classNames } from '../../../utils/common.tsx'
import Head from 'next/head'


const UserApp: NextPageWithLayout =  ({ userID }: AppProps) => {
    var [flows, setFlows] = useState()
    var [app, setApp] = useState()

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
        <Head>
            <title>{(app && app.name) || 'Untitled app'}</title>
            <meta property="og:title" content={(app && app.name) || 'Untitled app'} key="title" />
        </Head>
        <ul role="list" className="space-y-3">{flows?.map((flow, i) => <Flow
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
            />)}

            <li key='new' onClick={() => {
                    router.push(`/admin/app/${router.query.appid}/flow/new`)
                }}
                className='relative rounded-md rounded-lg border-2 border-gray-300 p-4 text-center text-gray-400 hover:text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer'>
                + Add a flow
            </li>
        </ul>
    </div>
}

export function getTabs(page){
    const router = useRouter()

    var urlProps = { appid: router.query.appid },
        subpagePathname = '/admin/app/[appid]/[subpage]',
        baseURL = `/admin/app/${router.query.appid}/`

    return [
      [{ name: 'Flows', href: baseURL, current: !page }],
      [{ name: 'Settings', href: {
          pathname: subpagePathname, query: { ...urlProps, subpage: 'settings' }
      }, current: page === 'settings' }]
    ]
}


UserApp.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs()}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}



const Flow = ({ flow, deleteFlow }) => {
    const router = useRouter()


    return <li className='relative rounded-md bg-indigo-600 text-white px-6 py-4 shadow'>
        <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
          <Menu as="div" className="relative block">
            <Menu.Button className="rounded text-slate-400 hover:text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              <span className="sr-only">Open options</span>
              <EllipsisVerticalIcon className="h-6 w-6" aria-hidden="true" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 -mr-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  {[
                      {
                          href: {
                              pathname: '/admin/app/[appid]/flow/[flowid]',
                              query: { appid: router.query.appid, flowid: router.query.flowid, flowid: 'new', duplicate: flow.id }
                          },
                          name: 'Duplicate'
                      },
                      { onClick: () => {
                          if (window.confirm('Are you sure you want to delete ' + flow.id + '?')){
                              deleteFlow(flow.id)
                          }
                      }, name: 'Delete...'}
                  ].map((item) => (
                    <Menu.Item key={item.name}>
                      {({ active }) => (
                        <a
                          href={item.href}
                          onClick={item.onClick}
                          className={classNames(
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                            'block px-4 py-2 text-sm'
                          )}
                        >
                          {item.name}
                        </a>
                      )}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        <div>
            <Link href={{
                pathname: '/admin/app/[appid]/flow/[flowid]',
                query: { appid: router.query.appid, flowid: flow.id }
            }}><a className="font-bold">{flow.name ? flow.name : ('Untitled flow' || flow.id)}</a></Link>
        </div>
        <div>

        </div>
    </li>
}


export default UserApp
