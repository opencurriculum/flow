import '../styles/globals.css'
import type { AppProps } from 'next/app'
import {useEffect, useState} from 'react'
import Cookies from 'js-cookie'
import { v4 as uuidv4 } from 'uuid'
import type { ReactElement, ReactNode } from 'react'
import { FirebaseAppProvider, FirestoreProvider, AnalyticsProvider, useFirebaseApp } from 'reactfire';
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"


export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
    const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_APP_ID,
        measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
    };

    var db;

    let userID = Cookies.get('userID')
    if (!userID){
        userID = uuidv4().substring(0, 8)
        Cookies.set('userID', userID, { expires: 365 })
    }

    // Use the layout defined at the page level, if available
    const getLayout = Component.getLayout ?? ((page) => page)

    return <div className='h-full flex flex-col'>
        <FirebaseAppProvider firebaseConfig={firebaseConfig}>
            <DatabaseSupportedApp>
                {getLayout(<Component {...pageProps} userID={userID} />)}
            </DatabaseSupportedApp>
        </FirebaseAppProvider>
    </div>
}


function DatabaseSupportedApp({ children }){
    const app = useFirebaseApp()
    var firestoreInstance = getFirestore()

    var analyticsInstance

    if (typeof window !== 'undefined'){
        analyticsInstance = getAnalytics(app)
    }

    if (process.env.NODE_ENV === 'development') {
        connectFirestoreEmulator(firestoreInstance, 'localhost', 8080);
    }  else {
        firestoreInstance = getFirestore(app)
        enableIndexedDbPersistence(db)
    }

    return <FirestoreProvider sdk={firestoreInstance}>
        {analyticsInstance ? <AnalyticsProvider sdk={analyticsInstance}>{children}</AnalyticsProvider> : children}
    </FirestoreProvider>
}


export default MyApp
