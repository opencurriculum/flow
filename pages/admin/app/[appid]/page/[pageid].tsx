import {useState, useEffect, useRef} from 'react'
import { NextPageWithLayout } from '../../../../_app'
import Layout from '../../../../../components/admin-layout'
import { getDoc, doc, setDoc, updateDoc } from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import { v4 as uuidv4 } from 'uuid'
import { Tab } from '@headlessui/react'
import { classNames, throttleCall } from '../../../../../utils/common'


const Page: NextPageWithLayout = ({}) => {
    const [page, setPage] = useState()
    const [selectedTabIndex, setSelectedTabIndex] = useState(0)

    const pageHTMLRef = useRef()
    const throttleRef = useRef()
    var textareaRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.pageid){
            if (router.query.pageid === 'new'){
                // Create a new page.

                // If there is a duplicate param, use that to make this new page.
                var newPageID = uuidv4().substring(0, 8)
                setDoc(doc(db, "apps", router.query.appid, 'pages', newPageID), {}).then(() => {
                    router.replace(`/admin/app/${router.query.appid}/page/${newPageID}`)
                })

            } else {
                getDoc(doc(db, "apps", router.query.appid, 'pages', router.query.pageid)).then(docSnapshot => {
                    if (docSnapshot.exists()){
                        var data = docSnapshot.data()
                        setPage(data)

                        if (data.html){
                            textareaRef.current.value = data.html
                        }
                    }
                })
            }
        }
    }, [router.query.pageid, db])

    useEffect(() => {
        if (page && pageHTMLRef.current !== page.html){
            throttleCall(throttleRef, html => {
                updateDoc(doc(db, "apps", router.query.appid, 'pages', router.query.pageid), { html })
            }, 3, page.html)

            pageHTMLRef.current = page.html
        }
    }, [page])

    useEffect(() => {
        if (selectedTabIndex === 0){
            textareaRef.current.focus()
        }
    }, [selectedTabIndex])


    return <div className="bg-gray-100 flex-auto">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mt-4">
              <Tab.Group selectedIndex={selectedTabIndex} onChange={setSelectedTabIndex}>
                <Tab.List className="flex space-x-1 rounded-xl bg-slate-200 p-1 mb-4">
                  <Tab
                      className={({ selected }) =>
                        classNames(
                          'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-slate-700',
                          'ring-white ring-opacity-60 ring-offset-2 ring-offset-slate-400 focus:outline-none focus:ring-2',
                          selected
                            ? 'bg-white shadow'
                            : 'text-slate-500 hover:bg-slate-100'
                        )
                      }
                  >HTML</Tab>
                  <Tab
                      className={({ selected }) =>
                        classNames(
                          'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-slate-700',
                          'ring-white ring-opacity-60 ring-offset-2 ring-offset-slate-400 focus:outline-none focus:ring-2',
                          selected
                            ? 'bg-white shadow'
                            : 'text-slate-500 hover:bg-slate-100'
                        )
                      }
                  >Preview</Tab>
                </Tab.List>
                <Tab.Panels>
                  <Tab.Panel>
                      <textarea
                        ref={textareaRef}
                        rows={40}
                        name="html"
                        id="html"
                        className="block w-full rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:py-1.5 sm:text-sm sm:leading-6"
                        defaultValue={page?.html}
                        onChange={e => setPage({ ...page, html: e.target.value })}
                      />
                  </Tab.Panel>
                  <Tab.Panel>
                    {page?.html ? <div dangerouslySetInnerHTML={{ __html: page.html }} /> : null}
                  </Tab.Panel>
                </Tab.Panels>
              </Tab.Group>
            </div>
        </div>
    </div>
}


Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
      {page}
    </Layout>
  )
}


export default Page
