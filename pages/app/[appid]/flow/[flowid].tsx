import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc, getCollection } from "firebase/firestore"
import { useRouter } from 'next/router'


const FlowWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.flowid)
        return null

    return <div>
        <Flow db={app.db} userID={userID} />
    </div>
}


const Flow: NextPage = ({ db, userID }: AppProps) => {
    var [progress, setProgress] = useState()
    var [steps, setSteps] = useState()
    const router = useRouter()

    useEffect(() => {
        var flowProgressRef = doc(db, "users", userID, 'progress', router.query.flowid)
        getDoc(flowProgressRef).then(docSnapshot => {
            if (!docSnapshot.exists()){
                setDoc(flowProgressRef, { completed: 0 })
                setProgress({ completed: 0 })
            } else {
                setProgress(docSnapshot.data())
            }
        })

        getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
            var unsortedSteps = []
            docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))
            setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
        })
    }, [])

    useEffect(() => {
        if (steps && progress){
            var stepProgress
            steps.forEach((step, i) => {
                // First, check the progress this has made.
                stepProgress = progress.steps && progress.steps[step.id] ? (
                    progress.steps[step.id].completed) : 0

                // If the progress is less than 100, or this is last one, stop at this.
                if (stepProgress < 100 || (i === steps.length - 1)){
                    // Redirect to this step.
                    router.replace(`/app/${router.query.appid}/flow/${router.query.flowid}/step/${step.id}`)
                }
            })
        }
    }, [steps, progress])

    return <div></div>
}

export default FlowWrapper
