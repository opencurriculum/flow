import { Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { TrashIcon } from '@heroicons/react/20/solid'
import { blockStyleFn, LoadingSpinner } from '../utils/common'
import { useState, useEffect, useRef } from 'react'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import update from 'immutability-helper'
import { useStorage } from 'reactfire'
import { v4 as uuidv4 } from 'uuid'
import { CursorArrowRaysIcon } from '@heroicons/react/24/outline'
import * as formulajs from '@formulajs/formulajs'


var nonExcelForumlae = {
        'FINDWHERE': (arr, key, value, propToPick) => arr.find(item => item[key] === value)[propToPick]
    },
    nonExcelForumlaeNames = Object.keys(nonExcelForumlae),
    allFormulaeNames = Object.keys(formulajs).concat(nonExcelForumlaeNames),

    formulaJSRegex = new RegExp(`(${allFormulaeNames.join('|')})\\((?!.*(${allFormulaeNames.join('|')})\\().+?\\)`)


const slateHost = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://slate-eta.vercel.app'


export var ContentInput = (body, formatting, { updateBody, toggleSelectedContent, selectContent }) => {
    const [editorState, setEditorState] = useState(EditorState.createEmpty())
    const [isEditing, setIsEditing] = useState()

    const bodyRef = useRef()
    const isEditingRef = useRef()
    const editorRef = useRef()

    useEffect(() => {
        if (body && body !== bodyRef.current && !isEditing){
            var newEditorState = EditorState.createWithContent(convertFromRaw(body))
            setEditorState(newEditorState)

            bodyRef.current = body
        }
    }, [body])

    // useEffect(() => {
    //     if (isEditing && isEditingRef.current !== isEditing){
    //         if (isEditing)
    //             selectContent()
    //
    //         isEditingRef.current === isEditing
    //     }
    // }, [isEditing])

    return <div className="bg-white h-full">
        <div className="p-1 h-full">
        <Editor editorState={editorState}
            placeholder={`Add some text`}
            blockStyleFn={blockStyleFn.bind(this, formatting)}
            onChange={(newEditorState) => {
                setIsEditing(true)
                setEditorState(newEditorState)
            }}
            onBlur={() => {
                updateBody(convertToRaw(editorState.getCurrentContent()))
                setTimeout(() => setIsEditing(false), 1)
            }}
            ref={ref => editorRef.current = ref}
        />
        </div>
    </div>
}


const EditableImage = (body, formatting, {updateBody, toggleSelectedContent, appID, flowID, stepID}) => {
    const storage = useStorage()

    return <div>
        {body ? <div className="relative">
            <div className="m-2 right-0 absolute bg-slate-900 hover:bg-slate-600 h-6 w-6 text-white"
            onClick={() => {
                // Delete the file.
                var pathname = new URL(body).pathname,
                    indexOfStart = pathname.indexOf('/o/') + 3

                const storageRef = ref(storage, decodeURIComponent(pathname.substring(indexOfStart)))

                deleteObject(storageRef).then(() => {
                    // File deleted successfully
                   // Update layout content to clear it.
                   updateBody(null)
                }).catch((error) => {
                    alert('Failed to delete the image.')
                });

            }}
        ><TrashIcon /></div>
            <img src={body} />
        </div> : <input type="file" accept="image/*" id="input" onChange={event => {
            var fileFullname = event.target.files[0].name
            var [filename, extension] = fileFullname.split('.')

            const storageRef = ref(storage, `app/${appID}/flow/${flowID}/step/${stepID}/${filename}-${uuidv4().substring(0, 3)}.${extension}`)

            uploadBytes(storageRef, event.target.files[0]).then((snapshot) => {
                getDownloadURL(storageRef).then((url) => {
                    updateBody(url)
                })
            })
        }} />}
    </div>
}


const IframeSelector = () => {
    return <div className='absolute cursor-pointer rounded bottom-2 right-2 w-8 h-8 bg-blue-500 p-1'>
        <span className="text-white"><CursorArrowRaysIcon /></span>
    </div>
}


function executeExcelFunction(fn){
    try {
        return Function('formulajs', `'use strict'; return formulajs.${fn}`)(formulajs)
    } catch (e){
        console.log(e)
        return
    }
}


function executeJSFunction(fn){
    try {
        return Function('formulae', `'use strict'; return formulae.${fn}`)(nonExcelForumlae)
    } catch (e){
        console.log(e)
        return
    }
}


function serializeProperty(key, value, response){
    if (value?.startsWith('=')){
        var prop, finalValue = value.substring(1)

        for (prop in response){
            if (finalValue.indexOf(prop) !== -1){
                finalValue = finalValue.replace(prop, typeof(response[prop]) === 'object' ? JSON.stringify(response[prop]) : response[prop])
            }
        }

        var excelFunctionMatch = true
        while (excelFunctionMatch){
            excelFunctionMatch = formulaJSRegex.exec(finalValue)

            if (excelFunctionMatch){
                var isExcelFormula = nonExcelForumlaeNames.indexOf(
                    excelFunctionMatch[0].substring(0, excelFunctionMatch[0].indexOf('('))) === -1,

                    functionResult = (
                        isExcelFormula ? executeExcelFunction(excelFunctionMatch[0]) : executeJSFunction(excelFunctionMatch[0]))

                if (functionResult === undefined)
                    return

                finalValue = finalValue.substring(0, excelFunctionMatch.index) + functionResult + finalValue.substring(excelFunctionMatch.index + excelFunctionMatch[0].length)
            }
        }

        return `${key}=${encodeURIComponent(finalValue)}`

    } else if (value) {
        return `${key}=${encodeURIComponent(value)}`
    }
}


const ArrayType = function(body, formatting, {response, updateBody}){
    const [properties, setProperties] = useState(body?.properties)
    const query = useIframeQuery(body, response, (properties) => {
        var number = Object.keys(properties).map(p => properties[p]).find(
            property => property.id === 'number')?.value

        if (number)
            return `number=${number}`
    })

    if (body?.properties && query === undefined)
        return <div className="pt-2 mx-auto"><LoadingSpinner /></div>

    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=array&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


let iframeQuerylineUpdateTimeout
function useIframeQuery(body, response, serialize){
    const [query, setQuery] = useState()
    const queryRef = useRef()

    useEffect(() => {
        if (body?.properties){
            var serializedQuery = serialize(body.properties)

            if (serializedQuery?.length && queryRef.current !== serializedQuery){
                clearTimeout(iframeQuerylineUpdateTimeout)

                // setSaving(true)
                iframeQuerylineUpdateTimeout = setTimeout(function(){
                    setQuery(serializedQuery)

                    // Persist this change.
                    clearTimeout(iframeQuerylineUpdateTimeout)
                }.bind(this), 5000);
            } else if (!serializedQuery?.length){
                setQuery(null)
            }

            queryRef.current = serializedQuery
        }
    }, [body?.properties, response])

    return query
}


let numberlineUpdateTimeout
const Numberline = function(body, formatting, {updateBody}){
    // piece=race%20track|13&piece=horse|6
    const [properties, setProperties] = useState(body?.properties)
    const [query, setQuery] = useState()
    const queryRef = useRef()

    function serializePieces(properties){
        var serializedPieces = [], propertiesAsArray = Object.keys(properties).map(
                p => properties[p]),
            pieces = propertiesAsArray.find(property => property?.id === 'pieces')?.value?.sort((a, b) => a.position - b.position),
            makepiececopy = propertiesAsArray.find(property => property?.id === 'makepiececopy')?.value

        if (pieces){
            var piecesAsArray = Object.keys(pieces)?.map(
                id => pieces[id]).sort((a, b) => a.position - b.position)
            if (piecesAsArray.length){
                piecesAsArray.forEach(piece => {
                    serializedPieces.push(`piece=${piece.items.find(prop => prop.title === 'Name').value}|${piece.items.find(prop => prop.title === 'Length').value}`)
                })
            }
        }

        if (makepiececopy !== undefined){
            serializedPieces.push(`makepiececopy=${makepiececopy}`)
        }

        return serializedPieces.join('&')
    }

    useEffect(() => {
        if (body?.properties){
            var serializedPiecesQuery = serializePieces(body.properties)

            if (serializedPiecesQuery.length && queryRef.current !== serializedPiecesQuery){
                clearTimeout(numberlineUpdateTimeout)
                // setSaving(true)
                numberlineUpdateTimeout = setTimeout(function(){
                    setQuery(serializedPiecesQuery)

                    // Persist this change.
                    clearTimeout(numberlineUpdateTimeout)
                }.bind(this), 5000);
            }

            queryRef.current = serializedPiecesQuery
        }
    }, [body?.properties])

    if (body?.properties && query === undefined)
        return <div className="pt-2 mx-auto"><LoadingSpinner /></div>

    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=numberline&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


const MultipleChoice = function(body, formatting, {updateBody, toggleSelectedContent, response, stepID}){
    // Example: option=asd&option=qwer&option=zxc&option=yuop
    const [properties, setProperties] = useState(body?.properties)

    const query = useIframeQuery(body, response, (properties) => {
        var serializedChoices = [], propertiesAsArray = Object.keys(properties).map(
                p => properties[p]),
            choices = propertiesAsArray.find(property => property.id === 'choices')?.value

        if (choices){
            var choicesAsArray = Object.keys(choices)?.map(
                id => choices[id]).sort((a, b) => a.position - b.position)
            if (choicesAsArray.length){
                choicesAsArray.forEach(choice => {
                    var serializedProperty = serializeProperty('option', choice.value, response)

                    if (serializedProperty)
                        serializedChoices.push(serializedProperty)
                })
            }
        }

        return serializedChoices.join('&')
    })

    if (body?.properties && query === undefined)
        return <div className="pt-2 mx-auto"><LoadingSpinner /></div>

    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=multiple-choice&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


export const ResponseTemplate = ({ body, formatting, updateBody, toggleSelectedResponseTemplateItems, toggleSelectedContent }) => {
    // This is a temp hack variable.
    var isInsideContentLayout = toggleSelectedResponseTemplateItems

    return <div>
        {body && body.map((responseItem, i) => <div key={i} className='flex' onClick={toggleSelectedResponseTemplateItems ? () => toggleSelectedResponseTemplateItems(responseItem) : null} >
            {isInsideContentLayout ? null : <div>
                {i ? <button
                    onClick={() => updateBody(update(body, {
                        $splice: [
                            [i, 1],
                            [i - 1, 0, body[i]]
                        ]
                    }) )}
                    type="button"
                  className="inline-flex items-center px-1.5 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowUpIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
                </button> : null}
                {i !== body.length - 1 ? <button
                    onClick={() => updateBody(update(body, {
                        $splice: [
                            [i, 1],
                            [i + 1, 0, body[i]]
                        ]
                    }) )}

                    type="button"
                  className="inline-flex items-center px-1.5 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowDownIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
                </button> : null}

            </div>}

            <div className='flex-grow'>{responseItem.kind === 'text' && isInsideContentLayout ? ContentInput(responseItem.body, formatting, (updatedBody) => {
                var newBody = [...body]
                newBody[i] = { ...responseItem, body: updatedBody }
                updateBody(newBody)
            }) : <span onClick={isInsideContentLayout ? null : () => toggleSelectedContent({ name: responseItem.id, kind: responseItem.kind })}>{responseItem.kind}</span>} {isInsideContentLayout ? null : <span onClick={() => updateBody(update(content, {
                    $splice: [[i, 1]]
                })
            )}>(Remove)</span>}
            </div>
        </div>)}
    </div>
}


const ResponseSpace = ({ setResponse, responseItem, response, formatting, stepID }) => {
    const inputRef = useRef()

    useEffect(() => {
        if (response){
            inputRef.current.value = response;
        } else {
            inputRef.current.value = '';
        }
    }, [stepID])

    return <input type='text' ref={inputRef}
        className={"shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md" + (formatting.display === 'inline-block' ? '' : ' block w-full')}
        onChange={(event) => setResponse(responseItem.id, event.target.value) }
    />
}


const CheckAnswerInput = (body, formatting, { updateBody, toggleSelectedContent, isSelected, contentSettings, setContentSettings }) => {
    const isSelectedRef = useRef()

    useEffect(() => {
        if (isSelected && isSelectedRef.current !== isSelected){
            setContentSettings({ ...contentSettings, all: { ...(contentSettings.all || {}), showContentLabels: true } })
        }

        return () => {
            setContentSettings({ ...contentSettings, all: { ...(contentSettings.all || {}), showContentLabels: false } })
        }
    }, [isSelected])

    return <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Check answer
    </button>
}


const ContentTypes = {
    Text: {
        editable: ContentInput,
        render: function(body, formatting){
            return <div style={formatting}>
                <Editor
                    blockStyleFn={blockStyleFn.bind(this, formatting)}
                    editorState={EditorState.createWithContent(convertFromRaw(body))}
                    readOnly={true}
                />
            </div>
        }
    },

    CheckAnswer: {
        editable: CheckAnswerInput,
        render: (body, formatting, {checkResponse}) => <div style={formatting}><button
              type="button" onClick={() => checkResponse(body?.properties[0])}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Check answer
        </button></div>,
        properties: [
            {
                id: 'formula', title: 'Check answer formula', kind: 'text'
            }
        ]
    },

    Image: {
        editable: EditableImage,
        render: (body, fomatting) => <img src={body} />
    },

    Response: {
        editable: (body, formatting, {updateBody, toggleSelectedContent, settings, setSettings}) => <ResponseTemplate
            body={body}
            formatting={formatting}
            updateBody={updateBody}
            toggleSelectedResponseTemplateItems={item => {
                // var indexOfItem = selectedResponseTemplateItems.findIndex(i => item.id === i.id)
                var indexOfItem = settings.templateItems?.findIndex(i => item.id === i.id)
                if (!settings.templateItems || indexOfItem === -1){
                    setSettings({ ...settings, templateItems: [...(settings.templateItems || []), item] })
                    // setSelectedResponseTemplateItems([...selectedResponseTemplateItems, item])
                } else {
                    setSettings({ ...settings, templateItems: settings.templateItems.filter((i, index) => index !== indexOfItem) })
                    // setSelectedResponseTemplateItems(selectedResponseTemplateItems.filter((i, index) => index !== indexOfItem))
                }
            }}
            toggleSelectedContent={toggleSelectedContent}
        />,
        render: (body, formatting, {contentFormatting, stepID, response, setResponse}) => {
            return <div>{body && body.map((responseItem, i) => {
                var responseItemFormatting = {...(contentFormatting && contentFormatting[responseItem.id] ? contentFormatting[responseItem.id] : {})}
                if (responseItem.kind === 'responsespace')
                    return <ResponseSpace key={i}
                        responseItem={responseItem} setResponse={setResponse}
                        response={response && response[responseItem.id]}
                        formatting={responseItemFormatting}
                        stepID={stepID}
                    />
                else
                    return <span key={i} style={responseItemFormatting}>
                        <Editor editorState={responseItem.body ? EditorState.createWithContent(convertFromRaw(responseItem.body)) : EditorState.createEmpty()} readOnly={true} />
                    </span>
            })}</div>
        },
        option: (id, {settings, setSettings}) => <button onClick={() => setSettings({ ...settings, changeFormat: id })}
            // setResponseChangeFormatOpen(id)
        >Change format</button>
    },

    ArrayType: {
        editable: ArrayType,
        render: ArrayType,
        properties: [
            {
                id: 'number', title: 'Number of boxes', kind: 'string'
            }
        ],
        responseProperties: ['columns', 'rows', 'remainder']
    },

    Numberline: {
        editable: Numberline,
        render: Numberline,
        properties: [
            {
                id: 'pieces', title: 'Pieces available', kind: 'list', items: {
                    kind: 'object', items: [
                        { kind: 'string', title: 'Name' },
                        { kind: 'integer', title: 'Length' }
                    ]
                }
            },
            {
                id: 'makepiececopy', kind: 'boolean', title: 'Duplicate pieces that get dropped on numberline'
            }
        ],
        responseProperties: ['scale', 'range', ['pieces', ['title', 'length', 'position']] ]
    },

    MultipleChoice: {
        editable: MultipleChoice,
        render: MultipleChoice,
        properties: [
            {
                id: 'choices', title: 'Choices', kind: 'list', items: {
                    kind: 'string', title: 'Option'
                }
            }
        ],
        responseProperties: [['selected', { 0: ['content', 'index']} ]]
    }
}

export default ContentTypes
