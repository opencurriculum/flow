import Layout, { TabbedPageLayout } from '../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import {getTabs} from '../[appid]'
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import { collection, getDocs } from "firebase/firestore"


const Pages: NextPageWithLayout = ({}: AppProps) => {
    var [pages, setPages] = useState()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.appid){
            getDocs(collection(db, "apps", router.query.appid, 'pages')).then(docsSnapshot => {
                var unsortedPages = []
                docsSnapshot.forEach(doc => unsortedPages.push({ id: doc.id, ...doc.data() }))

                setPages(unsortedPages)
            })
        }
    }, [router.query.appid, db])

    return <div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6">
          {pages?.map((page, i) => (
              <li key={i}>
                <Link href={{
                      pathname: '/admin/app/[appid]/page/[pageid]',
                      query: { appid: router.query.appid, pageid: page.id }
                  }}>
                <a className="relative flex items-center space-x-3 rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400">
                  {page.name}
                </a></Link>
              </li>
          ))}

          <li key='new'>
            <a onClick={() =>{
                router.push(`/admin/app/${router.query.appid}/page/new`)
            }}
              className="relative flex items-center space-x-3 rounded-lg border border-gray-300 px-6 py-5 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 hover:border-gray-400 cursor-pointer"
            >+ Create new page</a>
          </li>
        </ul>
    </div>
}


Pages.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('pages')} compress={false}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Pages
