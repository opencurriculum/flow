export default async function handler(req, res) {
    const {ltik, lineItemId, userID, score} = req.body

    const authorizationHeader = `LTIK-AUTH-V1 Token=${ltik}, Additional=Bearer ${process.env.LTIAAS_PRIVATE_KEY}`
    const response = await fetch(`https://flow.ltiaas.com/api/lineitems/${encodeURIComponent(lineItemId)}/scores`, {
        method: 'post',
        body: JSON.stringify({
          userId: userID,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          scoreGiven: score
        }),
        headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' }
    })
    const data = await response.json()

    res.status(200).send(data)
}
