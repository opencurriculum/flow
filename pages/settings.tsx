import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { getFirestore, collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, documentId } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useFirestore } from 'reactfire'
import Layout from '../components/admin-layout'
import type { NextPageWithLayout } from './_app'


const Settings: NextPageWithLayout = ({ userID }: AppProps) => {
    var [user, setUser] = useState()
    const router = useRouter()
    var nameRef = useRef(), websiteRef = useRef()

    var db = useFirestore()

    useEffect(() => {
        getDoc(doc(db, "users", userID)).then(docSnapshot => {
            if (docSnapshot.exists()){
                var user = docSnapshot.data()

                setUser(user)
                nameRef.current.value = user.name || ''
                websiteRef.current.value = user.website || ''
            }
        })
    }, [])

    return <div>
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
              placeholder="Something someone"
              onBlur={(event) => updateDoc(doc(db, "users", userID), { name: event.target.value })}
            />
          </div>
        </div>

        <div className='max-w-xs mx-auto'>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <div className="mt-1">
            <input
              ref={websiteRef}
              type="url"
              name="website"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="https://mypersonalwebsite.com"
              onBlur={(event) => updateDoc(doc(db, "users", userID), { website: event.target.value })}
            />
          </div>
        </div>
    </div>
}


Settings.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        {page}
    </Layout>
  )
}


export default Settings
