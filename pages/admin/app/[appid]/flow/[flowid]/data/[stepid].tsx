import Layout, { TabbedPageLayout } from '../../../../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../../../../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import {
    getDoc, doc, updateDoc, getDocs, collection
} from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import {getTabs} from '../../[flowid]'
import { UserContext } from '../../../../../../_app'
import { classNames } from '../../../../../../../utils/common'
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'


function displayData(response){
    var isObject = typeof(response) === 'object'

    if (isObject){
        var el = []
        if (response instanceof Array){
            response.forEach((responseItem, i) => {
                el.push(<div className="ml-2" key={i}>{displayData(responseItem)}</div>)
            })
        } else if (response !== undefined) {
            try {
                Object.keys(response).sort().forEach(responseItemKey => {
                    el.push(<div className="ml-2" key={responseItemKey}>{responseItemKey}: {displayData(response[responseItemKey])}</div>)
                })
            } catch(e){
                return JSON.stringify(response)
            }
        }

        return <div className="mb-2">{el}</div>
    } else {
         return response
    }
}


const UseStepData: NextPageWithLayout = ({}: AppProps) => {
    const [userStepProgress, setUserStepProgress] = useState()
    const router = useRouter(),
        db = useFirestore()
    const [user, userID] = useContext(UserContext)

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "users", router.query.user, 'progress', router.query.flowid)).then(docSnapshot => {
                setUserStepProgress(docSnapshot.data().steps[router.query.stepid])
            })
        }
    }, [router.query.flowid, db])

    var attempts = userStepProgress?.attempts.reverse()

    return <>
    <div className="flow-root">
      <ul role="list" className="-mb-8">
        {attempts?.map((attempt, attemptIdx) => (
          <li key={attemptIdx}>
            <div className="relative pb-8">
              {attemptIdx !== attempts.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  <span
                    className={classNames(
                      attemptIdx && userStepProgress.attempts.completed === 100 ? 'bg-red-500' : 'bg-green-500',
                      'h-8 w-8 rounded-full flex items-center justify-center'
                    )}
                  >
                    {attemptIdx && userStepProgress.attempts.completed === 100 ? <XMarkIcon className="h-5 w-5 text-white" aria-hidden="true" /> : (
                        <CheckIcon className="h-5 w-5 text-white" aria-hidden="true" />)}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                  <div>
                    <p className="text-sm text-gray-500">
                      {Object.keys(attempt.response).map((responseItemKey, i) => <div key={i}>
                              {responseItemKey} <span className="font-medium text-gray-900">{displayData(attempt.response[responseItemKey])}</span>
                          </div>
                      )}
                    </p>
                  </div>
                  <div className="whitespace-nowrap text-right text-sm text-gray-500">
                    <time dateTime={attempt.timestamp.toDate()}>{attempt.timestamp.toDate().toLocaleDateString("en-US", { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
    </>
}


UseStepData.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('data')} compress={true}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default UseStepData
