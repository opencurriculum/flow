import {getDoc, doc, updateDoc} from "firebase/firestore"
import extend from "deep-extend"


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


export function applyExperimentToLayoutContent(layoutContent, experiment, stepID){
    // Apply the experiment's changes, if one is active.
    if (experiment && experiment && experiment.current && experiment.current !== 'All'){
        var updatedLayoutContent = extend({}, layoutContent)

        const groupIndex = experiment.groups && experiment.groups.findIndex(group => group.name === experiment.current)
        experiment.groups && experiment.groups[groupIndex].steps[stepID] && experiment.groups[groupIndex].steps[stepID].forEach(change => {
            if (change.prop === 'layoutContent'){
                if (change.op === 'remove'){
                    delete updatedLayoutContent[change.id]
                } else if (['edit', 'add'].indexOf(change.op) !== -1){
                    updatedLayoutContent[change.id] = {
                        ...updatedLayoutContent[change.id], ...change.value
                    }
                }
            }
        })

        return updatedLayoutContent
    }

    return layoutContent
}


export function applyExperimentToContentFormatting(contentFormatting, experiment, stepID){
    // Apply the experiment's changes, if one is active.
    if (experiment && experiment && experiment.current && experiment.current !== 'All'){
        var updatedContentFormatting = extend({}, contentFormatting)

        const groupIndex = experiment.groups && experiment.groups.findIndex(group => group.name === experiment.current)
        experiment.groups && experiment.groups[groupIndex].steps[stepID] && experiment.groups[groupIndex].steps[stepID].forEach(change => {
            if (change.prop === 'contentFormatting'){
                if (change.op === 'remove'){
                    delete updatedContentFormatting[change.id][change.value.property]
                } else {
                    updatedContentFormatting[change.id] = {
                        ...updatedContentFormatting[change.id],
                        [change.value.property]: change.value.value
                    }
                }
            }
        })

        return updatedContentFormatting
    }

    return contentFormatting
}


export function applyExperimentToLayout(layout, experiment, stepID){
    // Apply the experiment's changes, if one is active.
    if (experiment && experiment && experiment.current && experiment.current !== 'All'){
        var updatedLayout = layout

        const groupIndex = experiment.groups && experiment.groups.findIndex(group => group.name === experiment.current)
        experiment.groups && experiment.groups[groupIndex].steps[stepID] && experiment.groups[groupIndex].steps[stepID].forEach(change => {
            if (change.prop === 'layout'){
                updatedLayout = JSON.parse(change.value)
            }
        })

        return updatedLayout
    }

    return layout
}


export function applyExperimentToResponseCheck(responseCheck, experiment, stepID){
    // Apply the experiment's changes, if one is active.
    if (experiment && experiment && experiment.current && experiment.current !== 'All'){
        var updatedResponseCheck = responseCheck

        const groupIndex = experiment.groups && experiment.groups.findIndex(group => group.name === experiment.current)
        experiment.groups && experiment.groups[groupIndex].steps[stepID] && experiment.groups[groupIndex].steps[stepID].forEach(change => {
            if (change.prop === 'responseCheck'){
                updatedResponseCheck = change.value
            }
        })

        return updatedResponseCheck
    }

    return responseCheck
}
