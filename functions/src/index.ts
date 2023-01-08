const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {FieldPath} = require('firebase-admin/firestore');

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

interface Data {
    from: string,
    to: string
}

interface Context {
}

admin.initializeApp();
const db = admin.firestore();


function changeUser(querySnapshot, from, to){
    querySnapshot.forEach(documentSnapshot => {
        var existingUsers = documentSnapshot.data().users || []
        if (existingUsers.length)
            existingUsers.splice(existingUsers.indexOf(from), 1)

        documentSnapshot.ref.update({ users: existingUsers.concat(to) });
    });
}


export const transferFromAnonymousAccount = functions.https.onCall((data: Data, context: Context) => {
    if (data.from && data.to){
        db.doc('users/' + data.from).get().then(documentSnapshot => {
            let ds = documentSnapshot.data();

            var toDocumentReference = db.doc('users/' + data.to)
            toDocumentReference.get().then(toDocumentSnapshot => {
                let toDs = toDocumentSnapshot.data();
                toDocumentReference.update({
                    apps: (toDs.apps || []).concat(ds.apps || []),
                    flows: (toDs.flows || []).concat(ds.flows || [])
                });
            })

            if (ds.apps){
                db.collection('apps').where(FieldPath.documentId(), 'in', ds.apps).get().then(querySnapshot => {
                    changeUser(querySnapshot, data.from, data.to)
                });
            }

            if (ds.flows){
                db.collection('flows').where(FieldPath.documentId(), 'in', ds.flows).get().then(querySnapshot => {
                    changeUser(querySnapshot, data.from, data.to)
                });
            }
        });
    }
    return
});
