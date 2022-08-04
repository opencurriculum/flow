import '../styles/globals.css'
import type { AppProps } from 'next/app'
import {useEffect, useState} from 'react'
import { connectToFirestore } from "../utils/firebase"
import Cookies from 'js-cookie'
import { v4 as uuidv4 } from 'uuid'


function MyApp({ Component, pageProps }: AppProps) {
    const [app, setApp] = useState()
    useEffect(() => {
        setApp(connectToFirestore())
    }, [])

    let userID = Cookies.get('userID')
    if (!userID){
        userID = uuidv4().substring(0, 8)
        Cookies.set('userID', userID, { expires: 365 })
    }

    return <div>
        <Component {...pageProps} app={app} userID={userID} />
    </div>
}

export default MyApp
