import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import useSWR from 'swr'
import {useRef, useEffect, useState} from 'react'
import { connectToFirestore } from "../utils/firebase"
import { collection, query, where, getDocs, getDoc, doc, updateDoc, getCollection, documentId } from "firebase/firestore"

const fetcher = (...args) => fetch(...args).then((res) => res.json())


const LTIDeepLinker: NextPage = ({}: AppProps) => {
    const router = useRouter()
    const activityURLRef = useRef(), formWrapperRef = useRef()
    var [app, setApp] = useState()

    useEffect(() => {
        setApp(connectToFirestore())
    }, [])

    const { data, error } = useSWR(`/api/lti/id-token?ltik=${router.query.ltik}`, fetcher)

    if (error) return <div>Failed to load</div>
    if (!data) return <div>Loading...</div>

    return <div>
        {data ? <div>
            <div>
                Paste a link to the activity you wish to assign:
                <div>
                    <input type="text" ref={activityURLRef} />
                </div>
            </div>
            <button onClick={async (event) => {
                var userPickedActivityURL = new URL(activityURLRef.current.value)

                var scoreMaximum, title,
                    pathPieces = userPickedActivityURL.pathname.split('/')

                // First, if this is a step, figure out the number of steps in this flow.
                // TODO: When the interface supports max points possible,
                // then determine the score maximum from that.
                var numSteps = 0, maxScorePerStep = 10

                var docSnapshot = await getDoc(doc(app.db, "apps", pathPieces[2]))
                var appData = docSnapshot.data()

                if (pathPieces.length <= 3){
                    // This is a link to the app itself.
                    if (appData.flows){
                        appData.flows.forEach(async flowID => {
                            // Get all the steps of all the flows.
                            var docsSnapshot = await getDocs(collection(app.db, "flows", flowID, 'steps'))
                            docsSnapshot.forEach(doc => numSteps += 1)
                        })
                    }

                    title = appData.name

                } else {
                    var flowDocSnapshot = await getDoc(doc(app.db, "flows", pathPieces[4]))
                    var flowData = flowDocSnapshot.data()

                    if (pathPieces.length <= 5){
                        // This is a link to the flow.
                        var docsSnapshot = await getDocs(collection(app.db, "flows", pathPieces[4], 'steps'))
                        docsSnapshot.forEach(doc => numSteps += 1)

                        title = `${appData.name} - ${flowData.name}`

                    } else {
                        // This is a link to a step.
                        title = `${appData.name} - ${flowData.name} - Step ${pathPieces[4]}`
                        numSteps = 1
                    }
                }

                scoreMaximum = numSteps * maxScorePerStep

                const response = await fetch(
                    `/api/lti/deep-link?ltik=${router.query.ltik}&flowResource=${userPickedActivityURL.pathname}&scoreMaximum=${scoreMaximum}&title=${title}`)
                const responseJSON = await response.json()
                // formWrapperRef.current.innerHTML = responseJSON.form
                // var newFormWrapper = document.createElement('div')
                // newFormWrapper.innerHTML = responseJSON.form
                // document.body.appendChild(newFormWrapper)

                var newFormWrapper = document.createElement('div')
                newFormWrapper.innerHTML = `<form id="ltijs_submit" style="display: none;" action="${responseJSON.endpoint}" method="POST"><input type="hidden" name="JWT" value="${responseJSON.message}" /></form>`
                document.body.appendChild(newFormWrapper)
                document.getElementById("ltijs_submit").submit()

            }}>Assign</button>
            <div ref={formWrapperRef} />
        </div> : null}
    </div>
}


export default LTIDeepLinker
