import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef, useContext} from 'react'
import { getFirestore, collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, documentId } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useFirestore } from 'reactfire'
import Layout from '../components/admin-layout'
import type { NextPageWithLayout } from './_app'
import { UserContext } from './_app'
import Head from 'next/head'
import { LoadingSpinner } from '../utils/common'


const Admin: NextPageWithLayout = ({ }: AppProps) => {
    var [apps, setApps] = useState()
    var [flows, setFlows] = useState()
    const router = useRouter()
    var db = useFirestore()
    const [user, userID] = useContext(UserContext)

    useEffect(() => {
        if (userID){
            var userRef = doc(db, "users", userID)
            getDoc(userRef).then(docSnapshot => {
                if (docSnapshot.exists()){
                    var user = docSnapshot.data(),
                        appIDs = user.apps || [],
                        flowIDs = user.flows || []

                    if (appIDs.length){
                        getDocs(query(collection(db, "apps"), where(documentId(), 'in', appIDs))).then(docsSnapshot => {
                            var unsortedApps = []
                            docsSnapshot.forEach(doc => unsortedApps.push({ id: doc.id, ...doc.data() }))
                            setApps(unsortedApps.sort(app => appIDs.indexOf(app.id)))
                        })
                    }

                    if (flowIDs.length){
                        getDocs(query(collection(db, "flows"), where(documentId(), 'in', flowIDs))).then(docsSnapshot => {
                            var unsortedFlows = []
                            docsSnapshot.forEach(doc => unsortedFlows.push({ id: doc.id, ...doc.data() }))
                            setFlows(unsortedFlows.sort(flow => flowIDs.indexOf(flow.id)))
                        })
                    }

                } else {
                    setDoc(userRef, { name: 'Someone something' })
                }
            })
        }
    }, [userID, db])

    return <>
        <Head>
            <title>Flow</title>
            <meta property="og:title" content='Flow' key="title" />
        </Head>

        {user !== undefined ? <div className='h-full bg-gray-100 flex-auto'>
            <div className="min-h-full">
                <main>
                  <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                      <div className="mb-20">
                          <div className="border-b border-gray-200 pb-5 mb-5">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">Apps</h3>
                          </div>

                          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
                            {apps?.map((app, i) => (
                                <li key={i}>
                                  <Link href={{
                                        pathname: '/admin/app/[appid]',
                                        query: { appid: app.id }
                                    }}>
                                  <a className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400">
                                    {app.name}
                                  </a></Link>
                                </li>
                            ))}

                            <li key='new'>
                              <a onClick={() =>{
                                  router.push(`/admin/app/new`)
                              }}
                                className="relative flex items-center space-x-3 rounded-lg border border-gray-300 px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400 cursor-pointer text-slate-900"
                              >+ Create new app</a>
                            </li>
                          </ul>
                      </div>

                      <div className="border-b border-gray-200 pb-5 mb-5">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Flows <span className="text-gray-400">(not in any app)</span></h3>
                      </div>
                      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
                        {flows?.map((flow, i) => (
                          <li key={i}>
                            <Link href={{
                                  pathname: '/admin/app/[appid]/flow/[flowid]',
                                  query: { appid: 'none', flowid: flow.id }
                              }}>
                            <a className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400
                            text-slate-900">
                              {flow.name}
                            </a></Link>
                          </li>
                        ))}

                        <li key='new'>
                          <a onClick={() => {
                              router.push(`/admin/app/none/flow/new`)
                          }}
                            className="relative flex items-center space-x-3 rounded-lg border border-gray-300 px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400 cursor-pointer
                            text-slate-900"
                          >+ Create new flow</a>
                        </li>
                      </ul>
                  </div>

                </main>
            </div>
        </div> : <LoadingSpinner />}
    </>
}


Admin.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        {page}
    </Layout>
  )
}


export default Admin
