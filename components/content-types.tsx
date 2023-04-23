import { Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage"
import { TrashIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { blockStyleFn, LoadingSpinner, run, classNames } from '../utils/common'
import { useState, useEffect, useRef, Fragment } from 'react'
import { ArrowUpIcon, ArrowDownIcon, PaintBrushIcon, PlusIcon } from '@heroicons/react/24/solid'
import update from 'immutability-helper'
import { useStorage } from 'reactfire'
import { v4 as uuidv4 } from 'uuid'
import { CursorArrowRaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { Dialog, Transition } from '@headlessui/react'



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


var uploadImage = function(storage, event, callback, { appID, flowID, stepID }){
    var fileFullname = event.target.files[0].name
    var [filename, extension] = fileFullname.split('.')

    const storageRef = ref(storage, `app/${appID}/flow/${flowID}/step/${stepID}/${filename}-${uuidv4().substring(0, 3)}.${extension}`)

    uploadBytes(storageRef, event.target.files[0]).then((snapshot) => {
        getDownloadURL(storageRef).then(callback)
    })

}


const EditableImage = (body, formatting, {updateBody, toggleSelectedContent, appID, flowID, stepID}) => {
    const storage = useStorage()
    const [openLibrary, setOpenLibrary] = useState(false)

    return <div>
        {body ? <div className="relative">
            <div className="m-2 right-0 absolute bg-slate-900 hover:bg-slate-600 h-6 w-6 text-white"
            onClick={() => {
                // Delete the file.
                var pathname = new URL(body.url).pathname,
                    indexOfStart = pathname.indexOf('/o/') + 3

                const storageRef = ref(storage, decodeURIComponent(pathname.substring(indexOfStart)))

                deleteObject(storageRef).then(() => {
                    // File deleted successfully
                   // Update layout content to clear it.
                   updateBody({ ...body, url: null })
                }).catch((error) => {
                    alert('Failed to delete the image.')
                });

            }}
        ><TrashIcon /></div>
            <img src={body.url} />
        </div> : <div>
            <input type="file" accept="image/*" id="input" onChange={event => {
                uploadImage(storage, event, (url) => {
                    updateBody({ ...body, url })
                }, { appID, flowID, stepID })
            }} />
            <button
                type="button"
                onClick={e => setOpenLibrary(true)}
                className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Pick from your app&#39;s images
            </button>
        </div>}
        <ImageLibrary open={openLibrary} setOpen={setOpenLibrary} appID={appID} insert={image => updateBody(image)} />

    </div>
}


const ImageLibrary = function({ open, setOpen, insert, appID, flowID, stepID }){
    const [images, setImages] = useState([])
    const [selectedImage, setSelectedImage] = useState()
    // const [showURLCopied, setShowURLCopied] = useState(true)

    const storage = useStorage()
    const cancelButtonRef = useRef(null)

    const uploadInputRef = useRef()

    useEffect(() => {
        if (open && !images.length){
            const listRef = ref(storage, `app/${appID}/flow`)

            listAll(listRef)
              .then((res) => {
                res.prefixes.forEach((flowFolderRef) => {
                    listAll(ref(flowFolderRef, '/step')).then((res) => {
                        res.prefixes.forEach((stepFolderRef) => {
                            listAll(stepFolderRef).then((res) => {
                                res.items.forEach((itemRef) => {
                                    getDownloadURL(itemRef).then((url) => {
                                        setImages(images => images.concat([url]))
                                    })
                                })
                            })
                        })
                    })
                });
            }).catch((error) => {
              // Uh-oh, an error occurred!
            });
        }
    }, [open])

    return <div>
        <Transition.Root show={open} as={Fragment}>
          <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={setOpen}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                    <div className="bg-white">
                      <div>
                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 px-4 sm:p-6">
                          App&#39;s image gallery
                        </Dialog.Title>
                        <div className="max-h-72 overflow-y-auto">
                            <ul role="list" className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-6 xl:gap-x-8 px-4 sm:p-6">
                              {images.map((image) => (
                                <li key={image} className="relative" onClick={() => {
                                    if (selectedImage !== image){
                                        setSelectedImage(image)
                                    } else {
                                        setSelectedImage()
                                    }
                                }}>
                                  <div className={classNames("group aspect-w-10 aspect-h-7 block w-full overflow-hidden rounded-lg bg-gray-100", selectedImage === image ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-100' : '')}>
                                    <img src={image} alt="" className="pointer-events-none object-cover group-hover:opacity-75" />
                                    <button type="button" className="absolute inset-0 focus:outline-none">
                                      <span className="sr-only">View details for {image}</span>
                                    </button>
                                  </div>
                                  <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">{new URL(decodeURIComponent(image)).pathname.split('/').slice(-1)}</p>
                                  {/*<p className="pointer-events-none block text-sm font-medium text-gray-500">{file.size}</p>*/}
                                </li>
                              ))}
                              {!insert ? <li key='upload' className="relative" onClick={() => {
                                  uploadInputRef.current.click()
                              }}>
                                  <input ref={uploadInputRef} className="hidden" type="file" accept="image/*" onChange={event => {
                                      uploadImage(storage, event, url => {
                                          setImages(images => images.concat([url]))
                                      }, { appID, flowID, stepID })
                                  }} />
                                  <div className={classNames("group aspect-w-10 aspect-h-7 block w-full overflow-hidden rounded-lg bg-gray-100")}>
                                    <PlusIcon alt="" className="pointer-events-none object-cover group-hover:opacity-75" />
                                    <button type="button" className="absolute inset-0 focus:outline-none">
                                      <span className="sr-only">Upload new...</span>
                                    </button>
                                  </div>
                                  <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">Upload new...</p>
                              </li> : null}
                            </ul>

                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:px-6">
                      <div className="flex flex-1">
                        <div>
                          <button
                            type="button"
                            className="mr-3 inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto sm:text-sm bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => {
                                navigator.clipboard.writeText(selectedImage)
                                alert('URL copied successfully')
                            }}
                          >
                            Copy URL
                          </button>
                        </div>
                        <div className="w-3/6 overflow-hidden text-ellipsis whitespace-nowrap leading-8 text-xs max-w-xs">
                          {selectedImage}
                        </div>
                      </div>
                      <div className="sm:flex-row-reverse">
                          {insert ? <button
                            type="button"
                            className={classNames("inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm", selectedImage ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-indigo-300 cursor-not-allowed')}
                            onClick={() => {
                                insert(selectedImage)
                                setOpen(false)
                            }}
                          >
                            Insert
                          </button> : null}
                          <button
                            type="button"
                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={() => setOpen(false)}
                            ref={cancelButtonRef}
                          >
                            {insert ? 'Cancel' : 'Close'}
                          </button>
                        </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
    </div>
}


const IframeSelector = () => {
    return <div className='absolute cursor-pointer rounded bottom-2 right-2 w-8 h-8 bg-blue-500 p-1'>
        <span className="text-white"><CursorArrowRaysIcon /></span>
    </div>
}

const DesignSelector = ({ onClick }) => {
    return <div className='absolute cursor-pointer rounded bottom-2 right-12 w-8 h-8 bg-blue-500 p-1' onClick={onClick}>
        <span className="text-white"><PaintBrushIcon /></span>
    </div>
}


function serializeProperty(key, value, response){
    if (value?.startsWith('=')){
        return `${key}=${encodeURIComponent(run(value.substring(1), response))}`

    } else if (value) {
        return `${key}=${encodeURIComponent(value)}`
    }
}


const ArrayType = function(body, formatting, {response, updateBody}){
    const [properties, setProperties] = useState(body?.properties)
    const query = useIframeQuery(body, response, (properties) => {
        // var number = Object.keys(properties).map(p => properties[p]).find(
        //     property => property.id === 'number')?.value
        var number = properties.number

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
        var serializedPieces = [], {pieces, makepiececopy, scales, initialScale, range, partsOfIntegers, slideBy} = properties
            // propertiesAsArray = Object.keys(properties).map(
            //     p => properties[p]),
            // pieces = propertiesAsArray.find(property => property?.id === 'pieces')?.value,
            // makepiececopy = propertiesAsArray.find(property => property?.id === 'makepiececopy')?.value

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

        if (scales){
            var scalesAsArray = Object.keys(scales)?.map(
                id => scales[id]).sort((a, b) => a.position - b.position)
            serializedPieces.push(`scales=${scalesAsArray.map(scale => scale.value).join(',')}`)
        }

        if (initialScale !== undefined){
            serializedPieces.push(`initialScale=${initialScale}`)
        }

        if (range && range.Start !== undefined && range.End !== undefined){
            serializedPieces.push(`range=${range.Start.value},${range.End.value}`)
        }

        if (partsOfIntegers){
            serializedPieces.push(`partsOfIntegers=fractions`)
        }

        if (slideBy !== undefined){
            serializedPieces.push(`slideBy=${slideBy}`)
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
        var serializedChoices = [], {choices, shuffle} = properties
            // propertiesAsArray = Object.keys(properties).map(
            //     p => properties[p]),
            // choices = propertiesAsArray.find(property => property.id === 'choices')?.value,
            // shuffle = propertiesAsArray.find(property => property?.id === 'shuffle')?.value

        if (choices){
            var choicesAsArray = Object.keys(choices)?.map(
                id => choices[id]).sort((a, b) => a.position - b.position)
            if (choicesAsArray.length){
                choicesAsArray.forEach(choice => {
                    var serializeOption = serializeProperty('option', `${choice.value}`, response),
                        serializedProperty = serializeOption + `�${choice.id}`

                    if (serializeOption !== 'option=undefined' && serializeOption !== 'option=null')
                        serializedChoices.push(serializedProperty)
                })
            }
        }

        if (!updateBody && (shuffle !== undefined)){
            serializedChoices.push(`shuffle=${shuffle}`)
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


export const ResponseTemplate = ({ body, formatting, updateBody, toggleSelectedResponseTemplateItems, name, toggleSelectedContent }) => {
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


const ResponseSpace = ({ setResponse, response, formatting, stepID }) => {
    const inputRef = useRef()
    const responseRef = useRef()

    useEffect(() => {
        if (response !== responseRef.current && inputRef.current !== document.activeElement){
            responseRef.current = response

            inputRef.current.value = response || '';
        }
    }, [stepID, response])

    return <input type='text' ref={inputRef}
        className={"shadow-sm focus:ring-indigo-500 focus:border-indigo-500 border-gray-300 rounded-md" + (formatting.display === 'inline-block' ? '' : ' block w-full')}
        onChange={(event) => setResponse && setResponse(event.target.value) }
    />
}


const Textarea = ({ setResponse, response, formatting, stepID }) => {
    const textareaRef = useRef()
    const responseRef = useRef()

    useEffect(() => {
        if (response !== responseRef.current && textareaRef.current !== document.activeElement){
            responseRef.current = response

            textareaRef.current.value = response || '';
        }
    }, [stepID, response])

    return <textarea ref={textareaRef}
        className="h-full block w-full rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:py-1.5 sm:text-sm sm:leading-6"
        onChange={(event) => setResponse && setResponse(event.target.value) }
    />
}


const Dropdown = ({ setResponse, response, formatting, stepID, body }) => {
    const selectRef = useRef()
    const responseRef = useRef()
    const [properties, setProperties] = useState(body?.properties)

    var optionsAsArray = []
    if (properties?.options){
        optionsAsArray = Object.keys(properties.options)?.map(
            id => properties.options[id]).sort((a, b) => a.position - b.position)
    }

    useEffect(() => {
        if (response !== responseRef.current && selectRef.current !== document.activeElement){
            responseRef.current = response

            selectRef.current.value = response || '';
        }
    }, [stepID, response])

    return <select
      ref={selectRef}
      id="dropdown"
      name="dropdown"
      className="block w-full rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
      onChange={(event) => {
          console.log(event.target.value)
          setResponse && setResponse(event.target.value)
      } }
    >
      {optionsAsArray.map((o) => <option key={o.id} value={o.value}>{o.value}</option>)}
    </select>
}


const ButtonInput = (body, formatting, { updateBody, toggleSelectedContent, isSelected, contentSettings, setContentSettings }) => {
    const isSelectedRef = useRef()

    /*
    useEffect(() => {
        if (isSelected && isSelectedRef.current !== isSelected){
            setContentSettings({ ...contentSettings, all: { ...(contentSettings.all || {}), showContentLabels: true } })
        }

        return () => {
            setContentSettings({ ...contentSettings, all: { ...(contentSettings.all || {}), showContentLabels: false } })
        }
    }, [isSelected])
    */

    return <button
          type="button"
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {body?.properties?.text || 'Button'}
    </button>
}


const BasicDesignableContentType = function(body, formatting, {response, updateBody, appID, flowID, stepID}, templateName, progressMergingFn){
    const [designOpen, setDesignOpen] = useState()
    const [query, setQuery] = useState(progressMergingFn ? progressMergingFn(body?.query) : body?.query)
    const bodyRef = useRef(body)

    useEffect(() => {
        if (bodyRef !== body){
            bodyRef.current = body
        }
    }, [body])

    useEffect(() => {
        if (updateBody && !designOpen){
            setTimeout(() => {
                setQuery(body?.query)
            }, 1000)
        }
    }, [designOpen])

    var iframeSrc = `${slateHost}/show?template=${templateName}${query ? `&${query}` : ''}`

    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody ? <DesignSelector onClick={e => {
            setDesignOpen(iframeSrc + '&mode=design')
            e.stopPropagation()
        }} /> : null}
        {updateBody ? <IframeSelector /> : null}
        <iframe src={iframeSrc} style={{ width: '100%', height: '100%' }}/>
        <DesignSlatePopup open={designOpen} setOpen={setDesignOpen} onSave={query => {
            updateBody({ ...body, query })
        }} template={templateName} appID={appID} flowID={flowID} stepID={stepID} />
    </div>
}


const DragIntoSlots = function(body, formatting, {response, updateBody, appID, flowID, stepID, name}){
    return BasicDesignableContentType(...[...arguments].slice(0, 3), 'drag-into-slots', (query) => {
        if (query && !updateBody && response){
            var updatedQuery = new URLSearchParams(query)

            var slots = updatedQuery.getAll('slot').map(slot => JSON.parse(slot)),
                pieces = updatedQuery.getAll('piece').map(piece => JSON.parse(piece))

            if (response[`{${name}}.filledSlots`] && response[`{${name}}.filledSlots`].length){
                response[`{${name}}.filledSlots`].forEach(filledSlot => {
                    // Find the piece.
                    var pieceToSet = pieces.find(piece => filledSlot.piece === piece.name)

                    // Set it on the particular slot.
                    slots.find(slot => filledSlot.slot === slot.name).piece = pieceToSet
                })

                updatedQuery.delete('slot')

                var updatedQueryString = updatedQuery.toString()
                slots.forEach(slot => {
                    updatedQueryString += `&slot=${encodeURIComponent(JSON.stringify(slot))}`
                })

                updatedQuery = new URLSearchParams(updatedQueryString)
            }

            return updatedQuery.toString()
        }

        return query
    })
}


const InteractiveVideo = function(body, formatting, {response, updateBody, appID, flowID, stepID}){
    return BasicDesignableContentType(...[...arguments].slice(0, 3), 'interactive-video')
}


const Hotspots = function(body, formatting, {response, updateBody, appID, flowID, stepID}){
    return BasicDesignableContentType(...[...arguments].slice(0, 3), 'hotspots')
}


const DesignSlatePopup = function({ open, setOpen, onSave, template, appID, flowID, stepID }){
    const iframeRef = useRef()
    const cancelButtonRef = useRef(null)
    const [url, setUrl] = useState(open)

    const [openLibrary, setOpenLibrary] = useState(false)

    const onDesignSlateMessageRef = useRef(function(setUrl, event){
        if (event?.data?.data?.hasOwnProperty('kind') && event.data?.data?.kind === 'urlQueryChange'){
            setUrl(event.data.data.value)
        }
    }.bind(null, setUrl))

    useEffect(() => {
        if (open){
            window.addEventListener('message', onDesignSlateMessageRef.current)
        } else {
            window.removeEventListener('message', onDesignSlateMessageRef.current)
        }

        return () => {
            window.removeEventListener('message', onDesignSlateMessageRef.current)
        }
    }, [open])

    return <div>
        <Transition.Root show={!!open} as={Fragment}>
          <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={setOpen}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <div className="fixed inset-0 z-10 overflow-y-auto">
              <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                  enterTo="opacity-100 translate-y-0 sm:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                  leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                >
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-5xl">
                    <div className="bg-white">
                      <div>
                        {open ? <iframe ref={iframeRef} src={open} className='w-full' style={{ height: '30rem' }} /> : null}
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:px-6">
                        <div className="flex-auto">
                            <button
                              type="button"
                              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                              onClick={() => setOpenLibrary(true)}
                            >
                              Open image library
                            </button>
                        </div>
                        <div className="sm:flex sm:flex-row-reverse">
                          <button
                            type="button"
                            className={classNames("inline-flex w-full justify-center rounded-md border border-transparent px-4 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm bg-indigo-600 hover:bg-indigo-700")}
                            onClick={() => {
                                var query = new URLSearchParams(url.replace('/show?', ''))
                                query.delete('template')
                                query.delete('mode')
                                onSave(query.toString())
                                setOpen(false)
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            onClick={() => setOpen(false)}
                            ref={cancelButtonRef}
                          >
                            Cancel
                          </button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>

        <ImageLibrary open={openLibrary} setOpen={setOpenLibrary}
            appID={appID} flowID={flowID} stepID={stepID} />
    </div>
}


const Webpage = (body, formatting, {response, updateBody}) => <div className='h-full'>
    {updateBody ? <IframeSelector /> : null}
    <iframe style={{ width: '100%', height: '100%' }} src={body?.properties?.src} />
</div>



const Video = (body, formatting, {response, updateBody}) => {
    var bodyEl = null
    if (body?.properties?.src){
        var isYoutube = body.properties.src.startsWith('https://www.youtube')

        if (isYoutube){
            bodyEl = <iframe style={{ width: '100%', height: '100%' }} src={body.properties.src} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen></iframe>

        } else {
            bodyEl = <video playsinline controls key={body.properties.src}>
                <source src={body.properties.src} />
            </video>
        }
    }

    return <div className='h-full'>
        {updateBody ? <IframeSelector /> : null}
        {bodyEl}
    </div>
}


const ContentTypes = {
    Text: {
        name: 'Text',
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

    DynamicText: {
        name: 'Dynamic Text',
        editable: (body, formatting, {response}) => <div
            dangerouslySetInnerHTML={{ __html: body?.properties?.formula && run(body?.properties?.formula, response) }}
        />,
        render: function(body, formatting, {response}){
            return <div style={formatting}
                dangerouslySetInnerHTML={{ __html: body?.properties?.formula && run(body?.properties?.formula, response) }}
            />
        },
        properties: [
            {
                id: 'formula', title: 'Dynamic text formula', kind: 'text'
            }
        ]
    },

    Button: {
        name: 'Button',
        editable: ButtonInput,
        render: (body, formatting, {checkResponse, name}) => <div style={formatting}><button
              type="button" /*onClick={() => checkResponse(body?.properties?.formula, name, body?.properties?.isStepCheck)}*/
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {(body?.properties?.text) || 'Button'}
        </button></div>,
        properties: [
            {
                id: 'text', title: 'Button text', kind: 'string'
            },
            // {
            //     id: 'formula', title: 'Formula to run on click', kind: 'text'
            // },
            // {
            //     id: 'isStepCheck', title: 'Formula success marks successful completion of step', kind: 'boolean'
            // }
        ],
        responseProperties: ['clicked', 'clickFormulaSucceeded']
    },

    Image: {
        name: 'Image',
        editable: EditableImage,
        render: (body, fomatting) => <img src={body.url} />
    },

    ShortResponseBox: {
        name: 'Short response box',
        editable: (body, formatting, {updateBody, toggleSelectedContent, settings, setSettings}) => <div>
            <ResponseSpace formatting={formatting} />
        </div>,
        render: (body, formatting, {contentFormatting, stepID, response, setResponse, name}) => <div>
            <ResponseSpace setResponse={(value) => {
                    setResponse(`{${name}}`, value)
                }}
                response={response && response[`{${name}}`]}
                formatting={formatting}
                stepID={stepID}
            />
        </div>,
    },

    LongResponseBox: {
        name: 'Long response box',
        editable: (body, formatting, {updateBody, toggleSelectedContent, settings, setSettings}) => <Textarea formatting={formatting} />,
        render: (body, formatting, {contentFormatting, stepID, response, setResponse, name}) => <Textarea setResponse={(value) => {
                setResponse(`{${name}}`, value)
            }}
            response={response && response[`{${name}}`]}
            formatting={formatting}
            stepID={stepID}
        />
    },

    MultiResponseBoxes: {
        name: 'Multi response boxes',
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
        render: (body, formatting, {contentFormatting, stepID, response, name, setResponse}) => {
            return <div>{body && body.map((responseItem, i) => {
                var responseItemFormatting = {...(contentFormatting && contentFormatting[responseItem.id] ? contentFormatting[responseItem.id] : {})}
                if (responseItem.kind === 'responsespace')
                    return <ResponseSpace key={i} stepID={stepID}
                        formatting={responseItemFormatting}

                        setResponse={(value) => {
                            setResponse(`{${name}}`, {
                                ...(response[`{${name}}`] || {}), [responseItem.id]: value,
                            })
                        }}
                        response={response && response[`{${name}}`] && response[`{${name}}`][responseItem.id]}
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
        name: 'Array',
        editable: ArrayType,
        render: ArrayType,
        properties: [
            {
                id: 'number', title: 'Number of boxes', kind: 'string'
            }
        ],
        responseProperties: ['columns', 'rows', 'remainder'],
        disableFormatting: true
    },

    Numberline: {
        name: 'Numberline',
        editable: Numberline,
        render: Numberline,
        properties: [
            {
                id: 'pieces', title: 'Pieces available', kind: 'list', items: {
                    kind: 'object', items: [
                        { kind: 'string', title: 'Name' },
                        { kind: 'number', title: 'Length' }
                    ]
                }
            },
            { id: 'makepiececopy', kind: 'boolean', title: 'Duplicate pieces that get dropped on numberline' },
            {
                id: 'scales', title: 'Scale (zoom) levels', kind: 'list', items: {
                    kind: 'number'
                }
            },
            {
                id: 'initialScale', title: 'Scale at the start', kind: 'number'
            },
            {
                id: 'range', kind: 'object', title: 'Range', items: [
                    { kind: 'number', title: 'Start' },
                    { kind: 'number', title: 'End' }
                ]
            },
            {
                id: 'partsOfIntegers', title: 'Show fractions instead of decimals under 1', kind: 'boolean'
            },
            {
                id: 'slideBy', title: 'Slide numberline forward and backward by (at scale=1)', kind: 'number'
            }

        ],
        responseProperties: ['scale', 'range', ['pieces', ['title', 'length', 'line', 'position']] ],
        disableFormatting: true
    },

    MultipleChoice: {
        name: 'Multiple choice answer',
        editable: MultipleChoice,
        render: MultipleChoice,
        properties: [
            {
                id: 'choices', title: 'Choices', kind: 'list', items: {
                    kind: 'string', title: 'Option'
                }
            },
            { id: 'shuffle', kind: 'boolean', title: 'Shuffle order for students' }
        ],
        responseProperties: [['selected', { 0: ['id', 'content', 'index']} ]],
        disableFormatting: true
    },

    DragIntoSlots: {
        name: 'Drag into slots',
        editable: DragIntoSlots,
        designable: true,
        render: DragIntoSlots,
        responseProperties: [['filledSlots', ['slot', 'piece']]],
        disableFormatting: true
    },

    InteractiveVideo: {
        name: 'Interactive video',
        editable: InteractiveVideo,
        designable: true,
        render: InteractiveVideo,
        responseProperties: [['completedPrompts', ['label', 'response']]],
        disableFormatting: true
    },

    Hotspots: {
        name: 'Hotspots',
        editable: Hotspots,
        designable: true,
        render: Hotspots,
        disableFormatting: true
    },

    Webpage: {
        name: 'Webpage',
        editable: Webpage,
        render: Webpage,
        properties: [
            {
                id: 'src', title: 'Webpage URL', kind: 'string'
            }
        ],
        disableFormatting: true
    },

    Video: {
        name: 'Video',
        editable: Video,
        render: Video,
        properties: [
            {
                id: 'src', title: 'YouTube embed URL or direct file URL', kind: 'string'
            }
        ],
        disableFormatting: true
    },

    Dropdown: {
        name: 'Dropdown',
        editable: (body, formatting, {updateBody, toggleSelectedContent}) => <Dropdown formatting={formatting} body={body} />,
        render: (body, formatting, {contentFormatting, stepID, response, setResponse, name}) => <Dropdown setResponse={(value) => {
                setResponse(`{${name}}`, value)
            }}
            response={response && response[`{${name}}`]}
            formatting={formatting}
            body={body}
            stepID={stepID}
        />,
        properties: [
            {
                id: 'options', title: 'Options', kind: 'list', items: {
                    kind: 'string'
                }
            },
        ],
    }

}

export default ContentTypes
