import Layout, { TabbedPageLayout } from '../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import {
    getDoc, doc, updateDoc
} from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import {getTabs} from '../[appid]'
import { UserContext } from '../../../_app'


const Settings: NextPageWithLayout = ({}: AppProps) => {
    var [app, setApp] = useState()
    const [user, userID] = useContext(UserContext)

    var nameRef = useRef(),
        allowStepsListingRef = useRef(),
        stepsAliasRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.appid){
            getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                var appData = docSnapshot.data()

                setApp(appData)
                nameRef.current.value = appData.name || ''
                allowStepsListingRef.current.checked = appData.allowStepsListing || false
                stepsAliasRef.current.value = appData.stepsAlias || ''
            })

        }
    }, [router.query.appid])

    return <>
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

    </>
}


Settings.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('settings')}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Settings
