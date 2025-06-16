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
import { SLATE_CONTENT_TYPES } from './slate-content-types'


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
        <Editor editorState={editorState} style={formatting}
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
        <ImageLibrary open={openLibrary} setOpen={setOpenLibrary} appID={appID} insert={url => updateBody({ ...body, url })} />

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


let iframeQuerylineUpdateTimeout
export function useIframeQuery(body, response, serialize){
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

    useEffect(() => {
        if (response !== inputRef.current.value && inputRef.current !== document.activeElement){
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

    useEffect(() => {
        if (response !== textareaRef.current.value && textareaRef.current !== document.activeElement){
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
          setResponse && setResponse(event.target.value)
      }}
      defaultValue={optionsAsArray?.length ? optionsAsArray[0].value : ''}
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


function transformSlateContentType(contentType){
    return {
        name: contentType.name,
        editable: addExtrasToContentTypeEditable(contentType.component),
        render: contentType.component,
        properties: contentType.properties,
        responseProperties: contentType.responseProperties,
        disableFormatting: true
    }
}


function addExtrasToContentTypeEditable(contentTypeEditable){
    return function(){
        return contentTypeEditable(...arguments, {ImageLibrary, imageLibraryProps: {
            appID: arguments[2].appID, flowID: arguments[2].flowID, stepID: arguments[2].stepID
        },
            IframeSelector, DesignSelector
        })
    }
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

    ArrayType: transformSlateContentType(
        SLATE_CONTENT_TYPES.find(ct => ct.name === 'Array')),

    MultipleChoice: transformSlateContentType(
        SLATE_CONTENT_TYPES.find(ct => ct.name === 'Multiple choice answer')),

    DragIntoSlots: transformSlateContentType(
        SLATE_CONTENT_TYPES.find(ct => ct.name === 'Drag into slots')),

    InteractiveVideo: transformSlateContentType(
        SLATE_CONTENT_TYPES.find(ct => ct.name === 'Interactive video')),

    Hotspots: transformSlateContentType(
        SLATE_CONTENT_TYPES.find(ct => ct.name === 'Hotspots')),

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
