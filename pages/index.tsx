import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import {useEffect} from 'react'
import { useRouter } from 'next/router'
import Cookies from 'js-cookie'


const Home: NextPage = () => {
    const router = useRouter()
    useEffect(() => {
        router.replace('/admin')
    })

  return (
    <div className={styles.container}></div>
  )
}

export default Home
