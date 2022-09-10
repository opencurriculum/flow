import fetch from 'node-fetch'

export default async function handler(req, res) {

    const ltik = req.query.ltik
    const authorizationHeader = `LTIK-AUTH-V1 Token=${ltik}, Additional=Bearer ${process.env.LTIAAS_PRIVATE_KEY}`
    const response = await fetch('https://flow.ltiaas.com/api/idtoken', {
        headers: { Authorization: authorizationHeader }
    })
    const idtoken = await response.json()

    res.status(200).json(idtoken)
}
