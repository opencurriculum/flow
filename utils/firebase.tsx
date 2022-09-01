import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from "firebase/firestore"
import { getAnalytics, isSupported } from "firebase/analytics"
import { initializeApp } from "firebase/app"

export const connectToFirestore = () => {
    if (!global.connectedToFirestore){
        global.connectedToFirestore = true;

        const app = initializeApp({
            apiKey: process.env.NEXT_PUBLIC_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_APP_ID,
            measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
        });

        var analytics = getAnalytics(app);
        var db;

        if (process.env.NODE_ENV === 'development') {
            db = getFirestore();
            connectFirestoreEmulator(db, 'localhost', 8080);
        } else {
            db = getFirestore(app)
            enableIndexedDbPersistence(db)
        }

        return { db, analytics }
    }
}
