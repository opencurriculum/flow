import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc, getCollection, documentId } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'


const AdminWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!(app && app.db))
        return null

    return <div>
        <Admin db={app.db} userID={userID} />
    </div>
}


const Admin: NextPage = ({ db, userID }: AppProps) => {
    var [apps, setApps] = useState()
    var [user, setUser] = useState()
    const router = useRouter()

    var nameRef = useRef(), websiteRef = useRef()

    useEffect(() => {
        getDoc(doc(db, "users", userID)).then(docSnapshot => {
            var user = docSnapshot.data(),
                appIDs = user.apps

            setUser(user)
            nameRef.current.value = user.name || ''
            websiteRef.current.value = user.website || ''

            getDocs(query(collection(db, "apps"), where(documentId(), 'in', appIDs))).then(docsSnapshot => {
                var unsortedApps = []
                docsSnapshot.forEach(doc => unsortedApps.push({ id: doc.id, ...doc.data() }))
                setApps(unsortedApps.sort(app => appIDs.indexOf(app.id)))
            })
        })
    }, [])

    return <div>
        <button onClick={() =>{
            router.push(`/admin/app/new`)
        }}>Create app</button>

        Apps
        {apps ? <ul>{apps.map((app, i) => <li key={i}><Link href={{
            pathname: '/admin/app/[appid]',
            query: { appid: app.id }
        }}><a>{app.name}</a></Link></li>)}</ul> : null}

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


export default AdminWrapper
