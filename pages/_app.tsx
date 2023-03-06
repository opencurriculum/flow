import '../styles/globals.css'
import type { AppProps } from 'next/app'
import {useEffect, useState, createContext} from 'react'
import Cookies from 'js-cookie'
import { v4 as uuidv4 } from 'uuid'
import type { ReactElement, ReactNode } from 'react'
import { FirebaseAppProvider, FirestoreProvider, AnalyticsProvider, StorageProvider, useFirebaseApp } from 'reactfire';
import { getAnalytics, isSupported } from "firebase/analytics"
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from "firebase/firestore"
import { getStorage } from "firebase/storage";
import {Login, useLogin} from '../components/login'
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";


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

    // Use the layout defined at the page level, if available
    const getLayout = Component.getLayout ?? ((page) => page)

    return <div className='min-h-full flex flex-col'>
        <FirebaseAppProvider firebaseConfig={firebaseConfig}>
            <DatabaseSupportedApp>
                {getLayout(<Component {...pageProps} />)}
            </DatabaseSupportedApp>
        </FirebaseAppProvider>
    </div>
}


export const UserContext = createContext({});


function DatabaseSupportedApp({ children }){
    const app = useFirebaseApp()
    var firestoreInstance = getFirestore()
    const storage = getStorage()
    const functions = getFunctions(app);

    var analyticsInstance

    if (typeof window !== 'undefined'){
        analyticsInstance = getAnalytics(app)
    }

    if (process.env.NODE_ENV === 'development' && !global.connectedToFirestore) {
        connectFirestoreEmulator(firestoreInstance, 'localhost', 8080)
        connectFunctionsEmulator(functions, "localhost", 5001)
        global.connectedToFirestore = true;

    }  else {
        firestoreInstance = getFirestore(app)
        // enableIndexedDbPersistence(firestoreInstance)
    }

    var loggedInChildren = <LoggedInApp>{children}</LoggedInApp>

    return <FirestoreProvider sdk={firestoreInstance}>
        <StorageProvider sdk={storage}>
            {analyticsInstance ? <AnalyticsProvider sdk={analyticsInstance}>
                {loggedInChildren}
            </AnalyticsProvider> : loggedInChildren}
        </StorageProvider>
    </FirestoreProvider>
}


function LoggedInApp({ children }){
    const [user, userID] = useLogin()

    return <UserContext.Provider value={[user, userID]}>
        {children}
    </UserContext.Provider>
}


export default MyApp
