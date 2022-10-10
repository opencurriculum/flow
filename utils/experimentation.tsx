import {getDoc, doc, updateDoc} from "firebase/firestore"


function assignExperimentGroupToStudent(db, experimentData, newGroupIndex, userID, experimentID){
    var newGroups
    if (!experimentData.groups[newGroupIndex].users){
        newGroups = { [newGroupIndex]: { users: { $set: [userID] } } }
    } else {
        newGroups = { [newGroupIndex]: { users: { $push: [userID] } } }
    }

    updateDoc(doc(db, "experiments", experimentID), { groups: update(experimentData.groups, newGroups) })
}


export function getOrInitializeFlowExperiment(db, flowID, userID, group, setExperiment){
    getDoc(doc(db, "flows", flowID)).then(docSnapshot => {
        if (docSnapshot.data().experiment){
            getDoc(docSnapshot.data().experiment).then(docSnapshot => {
                var experimentData = docSnapshot.data(), currentlyAssignedGroup

                if (group){
                    currentlyAssignedGroup = experimentData.groups.find(g => g.name === group)

                } else {
                    // Not really random at all. Yet.
                    var existingDistribution = [], totalUserCount = 0
                    currentlyAssignedGroup = experimentData.groups.find((g, i) => {
                        if (g.users && g.users.indexOf(userID) !== -1){
                            return true
                        }

                        totalUserCount += existingDistribution[i] = g.users ? g.users.length : 0
                    })

                    if (!currentlyAssignedGroup){
                        Object.keys(existingDistribution).forEach(groupIndex => {
                            if ((existingDistribution[groupIndex] / totalUserCount) < experimentData.groups[groupIndex].weight){
                                // Assign this group.
                                assignExperimentGroupToStudent(db, experimentData, groupIndex, userID, docSnapshot.id)

                                currentlyAssignedGroup = experimentData.groups[groupIndex]
                            }
                        })

                        if (!currentlyAssignedGroup){
                            var newGroupIndex = Math.floor(Math.random() * experimentData.groups.length)

                            // Assign this group.
                            assignExperimentGroupToStudent(db, experimentData, newGroupIndex, userID, docSnapshot.id)

                            currentlyAssignedGroup = experimentData.groups[newGroupIndex]
                        }
                    }
                }

                experimentData.current = currentlyAssignedGroup.name

                setExperiment(experimentData)
            })
        }
    })
}
