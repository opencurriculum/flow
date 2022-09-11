import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import useSWR from 'swr'


const fetcher = (...args) => fetch(...args).then((res) => res.json())

const LTILauncher: NextPage = ({}: AppProps) => {
    const router = useRouter()
    const {flowResource, ltik} = router.query

    const { data, error } = useSWR(`/api/lti/id-token?ltik=${router.query.ltik}`, fetcher)

    if (data){
        var params = {
            userID: data.user.id, lineItemId: data.launch.lineItemId, ltik,
            ltiResource: flowResource
        }
        const url = new URL(window.location.origin + flowResource);
        url.search = new URLSearchParams(params)
        window.location.href = url.toString()
    }

    if (error) return <div>Failed to load</div>
    if (!data) return <div>Loading...</div>

    return <div>Loading...</div>
}


export default LTILauncher
