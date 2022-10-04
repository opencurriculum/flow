import extend from "deep-extend"


export const blockStyleFn = (formatting, block) => {
    if (formatting && formatting.textAlign)
        return `textAlign-${formatting.textAlign}`
}


export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}


var uppercase = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K',
        'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
    ],
    lowercase = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
        'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'
    ];

export function t(term, app){
    if (app && app.stepsAlias){
        // Very very rough pluralization check that can break easily.
        var isPlural = term.substring(term.length - 1) === 's' && (
                term.substring(term.length - 2) !== 's'),
            isCamelCase = uppercase.indexOf(term.substring(0, 1)) !== -1,
            singularTerm = term;

        if (isPlural)
            singularTerm = term.substring(0, term.length - 1);

        if (singularTerm.toLowerCase() === 'step'){
            var newTerm = app.stepsAlias.substring(0, app.stepsAlias.length - 1);

            if (isPlural)
                newTerm += 's';

            if (isCamelCase)
                newTerm = uppercase[lowercase.indexOf(
                    newTerm.substring(0, 1))] + newTerm.substring(1);

            return newTerm;
        }
    }

    return term;
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


export function updateFlowProgressStateUponStepCompletion(stepID, progress, setProgress, numberOfSteps){
    setProgress({
        ...progress, completed: progress.completed + 100 / numberOfSteps,
        steps: {
            ...(progress.steps || {}),
            [stepID]: {
                ...((progress.steps && progress.steps[stepID]) || {}),
                completed: 100
            }
        }
    })
}
