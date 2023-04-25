import Layout, { TabbedPageLayout } from '../../../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import {
    getDoc, doc, updateDoc, getDocs, collection
} from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import {getTabs} from '../[flowid]'
import { UserContext } from '../../../../../_app'
import { classNames } from '../../../../../../utils/common'


const Data: NextPageWithLayout = ({}: AppProps) => {
    const [flow, setFlow] = useState()
    const [steps, setSteps] = useState()
    const router = useRouter(),
        db = useFirestore()
    const [user, userID] = useContext(UserContext)

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                var flowData = docSnapshot.data()
                setFlow(flowData)

                getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                    var unsortedSteps = []
                    docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))

                    setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
                })

            })
        }
    }, [router.query.flowid, db])

    var peopleIDs = flow?.progress && Object.keys(flow.progress).sort()

    return <>
        <div className="px-4 sm:px-6 lg:px-8">
        <div className="mt-8 flex flex-col">
            <div className="-my-2 -mx-4 sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle">
              <div className="shadow-sm ring-1 ring-black ring-opacity-5">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr className="divide-x divide-gray-200">
                      <th
                        scope="col"
                        className="sticky top-0 z-10 bg-gray-50 bg-opacity-75 py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 backdrop-blur backdrop-filter sm:pl-6 lg:pl-8"
                      >
                        Student Name
                      </th>
                      {steps?.map(step => <th key={step.id}
                            scope="col"
                            className="sticky top-0 z-10 hidden bg-gray-50 bg-opacity-75 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 backdrop-blur backdrop-filter sm:table-cell"
                          >
                            {step.name || `Untitled step (${step.id})`}
                      </th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {peopleIDs?.map((personID, personIdx) => {
                        var person = flow.progress[personID]
                      return <tr key={person.name} className="divide-x divide-gray-200">
                        <td
                          className={classNames(
                            personIdx !== peopleIDs.length - 1 ? 'border-b border-gray-200' : '',
                            'whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 lg:pl-8'
                          )}
                        >
                          {person.name}
                        </td>
                        {steps?.map(step => <td key={step.id}
                            className={classNames(
                              personIdx !== peopleIDs.length - 1 ? 'border-b border-gray-200' : '',
                              'whitespace-nowrap px-3 py-4 text-sm text-gray-500'
                            )}
                          >
                            {person.steps && person.steps[step.id] && person.steps[step.id].hasOwnProperty('completed') ? <Link href={{
                                pathname: '/admin/app/[appid]/flow/[flowid]/data/[stepid]',
                                query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id, user: personID }
                            }}>
                              <a className="text-indigo-600 hover:text-indigo-900">{person.steps[step.id].hasOwnProperty('completed') === 100 ? 'Completed' : 'Started'}</a>
                            </Link> : 'Not started'}
                        </td>)}
                      </tr>
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
            </div>
        </div>
    </>
}


Data.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('data')}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Data
