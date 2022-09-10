import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import useSWR from 'swr'


const fetcher = (...args) => fetch(...args).then((res) => res.json())

const LTILauncher: NextPage = ({}: AppProps) => {
    const router = useRouter()
    const {flowResource, ltik} = router.query

    const { data, error } = useSWR(`/api/lti/id-token?ltik=${router.query.ltik}`, fetcher)

    if (data){
        console.log(data)
        var params = {
            userID: data.user.id,
            lineItemId: data.launch.lineItemId
        }
        window.location.href = window.location.origin + flowResource + '?ltik=' + ltik
    }

    if (error) return <div>Failed to load</div>
    if (!data) return <div>Loading...</div>

    return <div>Loading...</div>
}


export default LTILauncher
