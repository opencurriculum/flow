export default async function handler(req, res) {
    const {ltik, flowResource, title, scoreMaximum} = req.query

    const link = {
      contentItems: [{
        type: 'ltiResourceLink',
        url: `https://flow.ltiaas.com/?flowResource=${flowResource}`,
        lineItem: {
            scoreMaximum,
            label: title,
            resourceId: flowResource,
            tag: 'grade'
        },
        title
      }],
      options: {
        message: 'Successfully imported the link.',
        log: 'deep_linking_successful'
      }
    }
    const authorizationHeader = `LTIK-AUTH-V1 Token=${ltik}, Additional=Bearer ${process.env.LTIAAS_PRIVATE_KEY}`
    const response = await fetch('https://flow.ltiaas.com/api/deeplinking/message', {
        method: 'post',
        body: JSON.stringify(link),
        headers: { Authorization: authorizationHeader, 'Content-Type': 'application/json' }
    })
    const data = await response.json()

    res.status(200).send(data)
}
