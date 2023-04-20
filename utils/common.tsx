import ContentTypes from '../components/content-types'
import extend from "deep-extend"
import {useState, useEffect, useRef} from 'react'
import * as formulajs from '@formulajs/formulajs'


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

const {Text, DynamicText, ShortResponseBox, LongResponseBox, Button,
    Image, ArrayType, Numberline, MultipleChoice, DragIntoSlots,
    InteractiveVideo, Hotspots
} = ContentTypes
export const StepContentTypes = [
    { kind: 'Text', ...Text },
    { kind: 'Dynamic Text', ...DynamicText },
    { kind: 'Image', ...Image },
    // { kind: 'Prompt', editable: Text.editable, render: Text.render },
    // { kind: 'Question', editable: Text.editable, render: Text.render },

    { kind: 'Short response box', ...ShortResponseBox },
    { kind: 'Long response box', ...LongResponseBox },
    { kind: 'Multiple choice answer', ...MultipleChoice },
    { kind: 'Button', ...Button },
    // { kind: 'Check answer', ...CheckAnswer },
    // { kind: 'Response', ...Response },

    { kind: 'Array', ...ArrayType },
    { kind: 'Numberline', ...Numberline },
    { kind: 'Drag into slots', ...DragIntoSlots },
    { kind: 'Interactive Video', ...InteractiveVideo },
    { kind: 'Hotspots', ...Hotspots },
]


export function applyEventsToLayoutContent(layoutContent, events){
    if (events && events.current){
        var updatedLayoutContent = extend({}, layoutContent)

        events[events.current] && events[events.current].click.forEach(change => {
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

export const LoadingSpinner = () => <svg className="animate-spin h-5 w-5 text-black mx-auto" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>


const slateHost = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://slate-eta.vercel.app'


export function useResponse(stepID){
    const [response, setResponse] = useState({})
    const responseRef = useRef(response)

    var processIframeData = function(event){
        if (event.origin === slateHost && event.data?.data?.kind !== 'urlQueryChange'){
            var eventResponses = {}

            // Determine which content it is coming from.
            var iframes = document.getElementsByTagName('iframe'), i = 0,
                contentName
            for (i = 0; i < iframes.length; i++){
                if (event.source === iframes[i].contentWindow){
                    var parent = iframes[i].parentNode
                    while (!contentName && parent !== document.body){
                        contentName = parent.dataset.contentname
                        parent = parent.parentNode
                    }
                    break
                }
            }

            event.data?.data.forEach(
                pieceOfData => eventResponses[`{${contentName}}.${pieceOfData.id}`] = pieceOfData.value)

            responseRef.current = { ...responseRef.current, [stepID]: {
                ...(responseRef.current[stepID] || {}), ...eventResponses }
            }
            setResponse(responseRef.current)
        }
    }

    useEffect(() => {
        if (stepID){
            window.addEventListener('message', processIframeData);

            return () => {
                window.removeEventListener('message', processIframeData);
            }
        }
    }, [stepID])

    return [response, setResponse]
}


var nonExcelForumlae = {
        FINDWHERE: (arr, ...keyValuesAndPropToPick) => {
            var propToPick = keyValuesAndPropToPick.splice(keyValuesAndPropToPick.length - 1, 1)[0],
                keyValues

            var index, found

            var match = arr.find(item => {
                found = true
                for (index = 0; index < keyValuesAndPropToPick.length - 1; index += 2){
                    found = found && item[keyValuesAndPropToPick[index]] === keyValuesAndPropToPick[index + 1]
                }
                return found
            })

            if (match)
                return match[propToPick]
        },

        TAKE: (arr, startIndex, endIndex) => arr.splice(startIndex, endIndex),
        GROUP: (...futureArrayItems) => futureArrayItems,
        GROUPLEN: arr => arr.length,
        FILTER: arr => arr.filter(i => i),
        JOIN: (arr, delimiter) => arr.join(delimiter),
        UNDEFINEDIF: (statement, truth) => statement ? truth : undefined,
        TOSTRING: thing => thing.toString(),
        DONTSOLVE: thing => ({ DONTSOLVE: thing })
    },
    nonExcelForumlaeNames = Object.keys(nonExcelForumlae),
    allFormulaeNames = Object.keys(formulajs).concat(nonExcelForumlaeNames),

    formulaJSRegex = new RegExp(`(${allFormulaeNames.join('|')})\\((?!.*(${allFormulaeNames.join('|')})\\().*?\\)`)


function executeExcelFunction(fn){
    try {
        return Function('formulajs', `'use strict'; return formulajs.${fn}`)(formulajs)
    } catch (e){
        console.log(e)
        return
    }
}


function executeJSFunction(fn){
    if (fn.startsWith('DONTSOLVE')){
        return nonExcelForumlae.DONTSOLVE(fn.substring(10, fn.length - 1).trim())
    }

    try {
        return Function('formulae', `'use strict'; return formulae.${fn}`)(nonExcelForumlae)
    } catch (e){
        console.log(e)
        return
    }
}

var variablesRegex = new RegExp('\{[\\s\\w]+\}(\.?\\w+)')

export function run(value, response){
    var prop, finalValue = value

    for (prop in response){
        if (finalValue.indexOf(prop) !== -1){
            finalValue = finalValue.replaceAll(prop, typeof(response[prop]) === 'object' ? JSON.stringify(response[prop]) : response[prop])
        }
    }

    // Filter out any variables with undefined.
    var variableMatch = true
    while (variableMatch){
        variableMatch = variablesRegex.exec(finalValue)

        if (variableMatch){
            finalValue = finalValue.substring(0, variableMatch.index) + ' undefined ' + finalValue.substring(
                variableMatch.index + variableMatch[0].length)
        }
    }

    var excelFunctionMatch = true
    while (excelFunctionMatch){
        excelFunctionMatch = formulaJSRegex.exec(finalValue)

        if (excelFunctionMatch){
            var isExcelFormula = nonExcelForumlaeNames.indexOf(
                excelFunctionMatch[0].substring(0, excelFunctionMatch[0].indexOf('('))) === -1

            var functionResult = (
                isExcelFormula ? executeExcelFunction(excelFunctionMatch[0]) : executeJSFunction(excelFunctionMatch[0]))

            // if (functionResult === undefined)
            //     return

            finalValue = finalValue.substring(0, excelFunctionMatch.index) + (
                typeof(functionResult) === 'object' ? JSON.stringify(functionResult) : functionResult) + (
                    finalValue.substring(excelFunctionMatch.index + excelFunctionMatch[0].length))
        }
    }


    if (finalValue.indexOf('DONTSOLVE') !== -1){
        return JSON.parse(finalValue).DONTSOLVE
    } else {
        try {
            return Function(`'use strict'; return ${finalValue}`)()
        } catch (e){
            try {
                return Function(`'use strict'; return "${finalValue}"`)()
            } catch (e){
                console.log(e)
            }
        }
    }
}


let throttleTimeouts = {}

export function throttleCall(ref, fn, seconds){
    clearTimeout(throttleTimeouts[ref.current])
    throttleTimeouts[ref.current] = setTimeout(() => {
        fn.apply(null, Array.prototype.slice.call(arguments, 3))
        clearTimeout(throttleTimeouts[ref.current])
    }, seconds * 1000);
    return throttleTimeouts[ref.current]
}
