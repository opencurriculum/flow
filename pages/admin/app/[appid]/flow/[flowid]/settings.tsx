import Layout, { TabbedPageLayout } from '../../../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../../_app'
import {useState, useEffect, useRef} from 'react'
import {
    getDoc, doc, updateDoc
} from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import {getTabs} from '../[flowid]'


const Settings: NextPageWithLayout = ({ userID }: AppProps) => {
    var singlePageFlowRef = useRef(),
        assignStepsIndividuallyRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                var flowData = docSnapshot.data()
                // setApp(appData)
                singlePageFlowRef.current.checked = flowData.singlePageFlow || false
                assignStepsIndividuallyRef.current.checked = flowData.assignStepsIndividually || false
            })
        }
    }, [router.query.appid])

    return <>
        <div className="relative flex items-start">
          <div className="flex h-5 items-center">
            <input
              ref={singlePageFlowRef}
              aria-describedby="singlePageFlow-description"
              name="singlePageFlow"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              onChange={(event) => updateDoc(doc(db, "flows", router.query.flowid), { singlePageFlow: event.target.checked })}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor="comments" className="font-medium text-gray-700">
              Show all steps on the same page
            </label>
            <p id="comments-description" className="text-gray-500">
              Students will see all steps on the same flow page (like a printed worksheet), and be able to easily refer back to previous work without changing the page.
            </p>

            <div>
                <Link href={{
                    pathname: '/admin/app/[appid]/flow/[flowid]/header',
                    query: { appid: router.query.appid, flowid: router.query.flowid }
                }}>
                    <button
                      type="button" onClick={() => {}}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Add header
                    </button>
                </Link>
                {/*<button
                  type="button" onClick={() => {}}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Add footer
                </button>*/}
            </div>
          </div>
          </div>


            <div className="relative flex items-start">
              <div className="flex h-5 items-center">
                <input
                  ref={assignStepsIndividuallyRef}
                  aria-describedby="assignStepsIndividually-description"
                  name="assignStepsIndividually"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  onChange={(event) => updateDoc(doc(db, "flows", router.query.flowid), { assignStepsIndividually: event.target.checked })}
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="comments" className="font-medium text-gray-700">
                  Assign steps individually
                </label>
                <p id="comments-description" className="text-gray-500">
                  Instead of students progressing through the flow as they make progress on step-after-step, let me manually assign each step. This will also turn off auto-progress on successful completion to a step.
                </p>
            </div>
        </div>
    </>
}


Settings.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('settings', router)}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Settings
