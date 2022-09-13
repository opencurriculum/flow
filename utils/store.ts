import {
    collection, query, where, getDocs, setDoc, getDoc, doc, updateDoc,
    getCollection, documentId, arrayUnion, writeBatch, deleteDoc
} from "firebase/firestore"


function getBatchedInSnapshots(db, sourceCollection, inArray){
    var duplicateInArray = inArray.slice(0), batches = []
    while (duplicateInArray.length){
        const batch = duplicateInArray.splice(0, 10)
        batches.push(
            getDocs(query(sourceCollection, where(documentId(), 'in', batch))).then(docsSnapshot => {
                var unsortedDocs = []
                docsSnapshot.forEach(doc => unsortedDocs.push({ id: doc.id, ...doc.data() }))
                return unsortedDocs
            })
        )
    }

    return Promise.all(batches).then(content => content.flat());
}


export function getAppFlows(db, flows){
    return getBatchedInSnapshots(db, collection(db, "flows"), flows)
}


export function getFlowsProgress(db, userID, flows){
    return getBatchedInSnapshots(db, collection(db, "users", userID, 'progress'), flows)
}
