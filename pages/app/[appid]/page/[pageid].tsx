import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import {UserAppHeader} from '../../[appid].tsx'
import Head from 'next/head'
import { getDoc, doc } from "firebase/firestore"


const Page: NextPage = ({}: AppProps) => {
    const [page, setPage] = useState()
    const htmlWrapperRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.pageid){
            getDoc(doc(db, "apps", router.query.appid, 'pages', router.query.pageid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setPage(docSnapshot.data())
                }
            })
        }
    }, [router.query.pageid, db])


    var routeThroughBrowserState = (e) => {
        router.push(e.target.href)
        e.preventDefault()
    }

    useEffect(() => {
        if (page){
            var allAs = htmlWrapperRef.current.querySelectorAll(`a[href^='${window.location.origin}']`), i
            for (i = 0; i < allAs.length; i++){
                allAs[i].addEventListener('click', routeThroughBrowserState)
            }

            return () => {
                for (i = 0; i < allAs.length; i++){
                    allAs[i].removeEventListener('click', routeThroughBrowserState)
                }
            }
        }
    }, [page])

    return <div>
        <Head>
            <title>{page && page.name}</title>
            <meta property="og:title" content={page && page.name} key="title" />
        </Head>

        <UserAppHeader db={db} />

        {page ? <div className="mx-auto px-4 sm:px-6 lg:px-8">
            {page?.html ? <div ref={htmlWrapperRef} dangerouslySetInnerHTML={{ __html: page.html }} /> : null}
        </div> : null}
    </div>
}


export default Page
