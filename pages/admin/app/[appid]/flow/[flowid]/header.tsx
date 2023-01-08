import { useState, useEffect, useRef, useContext } from 'react'
import Layout from '../../../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../../_app'
import WYSIWYGPanels from '../../../../../../components/wysiwyg'
import { v4 as uuidv4 } from 'uuid'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, writeBatch, deleteField, deleteDoc } from "firebase/firestore"
import { diff } from 'json-diff'
import { UserContext } from '../../../../../_app'



const initialLayout = [
  { i: "a", x: 0, y: 0, w: 12, h: 2 },
]


const Header: NextPage = ({}: AppProps) => {
    const [layout, setLayout] = useState(null)
    const layoutRef = useRef(null)

    const [layoutContent, setLayoutContent] = useState({})
    const layoutContentRef = useRef(null)

    const [contentFormatting, setContentFormatting] = useState(null)
    const contentFormattingRef = useRef(null)

    const router = useRouter(),
        db = useFirestore()

    const [user, userID] = useContext(UserContext)

    var setInitialData = (docSnapshot) => {
        var snapshotData = docSnapshot.data()

        setLayout(snapshotData.header && snapshotData.header.layout ? snapshotData.header.layout : initialLayout)

        if (snapshotData.header && snapshotData.header.layoutContent)
            setLayoutContent(snapshotData.header.layoutContent)

        if (snapshotData.header && snapshotData.header.contentFormatting)
            setContentFormatting(snapshotData.header.contentFormatting)
    }

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setInitialData(docSnapshot)
                }
            })
        }
    }, [router.query.flowid])

    useEffect(() => {
        if (layout && layoutRef.current && diff(layoutRef.current, layout)){
            updateDoc(doc(db, "flows", router.query.flowid), { 'header.layout': layout })
        }

        layoutRef.current = layout
    }, [layout])

    useEffect(() => {
        if (layoutContent && Object.keys(layoutContent).length && JSON.stringify(layoutContentRef.current) !== JSON.stringify(layoutContent)){
            updateDoc(doc(db, "flows", router.query.flowid), { 'header.layoutContent': layoutContent })
        }

        layoutContentRef.current = { ...layoutContent }
    }, [layoutContent])

    useEffect(() => {
        if (contentFormatting && contentFormattingRef.current !== contentFormatting){
            updateDoc(doc(db, "flows", router.query.flowid), { 'header.contentFormatting': contentFormatting })
        }

        contentFormattingRef.current = contentFormatting
    }, [contentFormatting])


    var flow
    return <div className='flex flex-col flex-auto'>
        <Head>
            <title>{flow && flow.name || 'Flow header'}</title>
            <meta property="og:title" content={flow && flow.name || 'Flow header'} key="title" />
        </Head>

        <WYSIWYGPanels context='header'
            layout={layout}
            onLayoutChange={(newLayout) => {
                setLayout(JSON.parse(JSON.stringify(newLayout)))
            }}
            onDrop={(newLayout, layoutItem) => {
                var indexOfNewLayoutItem = newLayout.indexOf(layoutItem)
                newLayout[indexOfNewLayoutItem] = {
                    ...newLayout[indexOfNewLayoutItem], i: uuidv4().substring(0, 4)
                }
                delete newLayout[indexOfNewLayoutItem].isDraggable

                setLayout(JSON.parse(JSON.stringify(newLayout)))
            }}

            layoutContent={layoutContent}
            updateLayoutContent={(id, value) => {
                if (value){
                    if (layoutContent.hasOwnProperty(id)){
                        layoutContent[id] = { ...layoutContent[id], ...value }
                    } else {
                        layoutContent[id] = value
                    }
                } else {
                    if (contentFormatting.hasOwnProperty(layoutContent[id].name)){
                        var newContentFormatting = {...contentFormatting}
                        delete newContentFormatting[layoutContent[id].name]
                        setContentFormatting(newContentFormatting)
                    }

                    delete layoutContent[id]
                }

                setLayoutContent({ ...layoutContent })
            }}

            formatting={contentFormatting}
            updateFormatting={(selectedContent, property, value) => {
                // If there is part of an experiment condition, set the changed formatting there.
                var newFormatting = { ...(contentFormatting || {}), [selectedContent] : {
                    ...(contentFormatting && contentFormatting[selectedContent] ? contentFormatting[selectedContent] : {}),
                }}

                if (value !== undefined){
                    newFormatting[selectedContent][property] = value
                } else if (newFormatting[selectedContent].hasOwnProperty(property)){
                    delete newFormatting[selectedContent][property]

                    if (!Object.keys(newFormatting[selectedContent]).length){
                        delete newFormatting[selectedContent]
                    }
                }

                setContentFormatting(newFormatting)
            }}
        />

    </div>
}


Header.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
      {page}
    </Layout>
  )
}


export default Header
