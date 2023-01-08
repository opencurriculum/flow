import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut, signInAnonymously } from "firebase/auth";
import {useState, useEffect} from 'react'
import Router, {useRouter} from 'next/router'
import Cookies from 'js-cookie'
import { v4 as uuidv4 } from 'uuid'
import { getDocs, getDoc, query, collection, where, setDoc, doc, serverTimestamp, arrayUnion } from "firebase/firestore"
import { useFirestore } from 'reactfire'
import { httpsCallable, getFunctions } from "firebase/functions";


export default function login(){
    const provider = new GoogleAuthProvider()
    const auth = getAuth()

    signInWithRedirect(auth, provider)
}


export function logout(){
    const auth = getAuth()
    signOut(auth).then(() => {
        Router.router.push('https://github.com/opencurriculum/flow#readme')
    })
}


export function useLogin(){
    const [user, setUser] = useState()
    const [userID, setUserID] = useState()
    const db = useFirestore()
    const auth = getAuth()
    const functions = getFunctions()

    useEffect(() => {
        if (user === null){
            signInAnonymously(auth)
        }
    }, [user])

    auth.onAuthStateChanged(function(u){
        if (u?.isAnonymous){
            // Is this the first visit?
            if (!Cookies.get('userID')){
                if (Router.router.pathname.startsWith('/admin')){
                    Router.router.replace('/admin/app/none/flow/new')
                }
            }

            if (!Cookies.get('userID') || u.uid !== Cookies.get('userID')){
                Cookies.set('userID', u.uid, { expires: 365 })
            }

        // If we have a logged in user here.
        } else if (u && !u.isAnonymous && !user){
            getDoc(doc(db, "users", u.uid)).then(docSnapshot => {
                if (!docSnapshot.exists()){
                    setDoc(doc(db, 'users', u.uid), {
                        name: u.displayName,
                        email: u.email,
                        created: serverTimestamp(),
                        photoURL: u.photoURL,
                    }).then(() => {
                        // Transfer anonymous user stuff to new account.
                        httpsCallable(functions, 'transferFromAnonymousAccount')(
                            { from: Cookies.get('userID'), to: u.uid })

                        Cookies.remove('userID')
                    })
                }
            })
        }

        setUser(u)
    })

    return [user, user?.uid]
}
