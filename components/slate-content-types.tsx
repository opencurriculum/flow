import { useState, useEffect, useRef, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { v4 as uuidv4 } from 'uuid'


export function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

const slateHost = process.env.NODE_ENV === 'development' ? 'http://localhost:5000' : 'https://slate-eta.vercel.app'

const LoadingSpinner = () => <svg className="animate-spin h-5 w-5 text-black mx-auto" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
</svg>


let iframeQuerylineUpdateTimeout = {}

export function useIframeQuery(body, response, serialize){
    const [query, setQuery] = useState()
    const queryRef = useRef()
    const idRef = useRef(uuidv4())

    useEffect(() => {
        if (body?.properties){
            var serializedQuery = serialize(body.properties)

            if (serializedQuery?.length && queryRef.current !== serializedQuery){
                clearTimeout(iframeQuerylineUpdateTimeout[idRef.current])

                // setSaving(true)
                iframeQuerylineUpdateTimeout[idRef.current] = setTimeout(function(){
                    setQuery(serializedQuery)

                    // Persist this change.
                    clearTimeout(iframeQuerylineUpdateTimeout[idRef.current])
                }.bind(this), 5000);
            } else if (!serializedQuery?.length){
                setQuery(null)
            }

            queryRef.current = serializedQuery
        }
    }, [body?.properties, response])

    return query
}



function serializeProperty(key, value, response){
    if (value?.startsWith('=')){
        return `${key}=${encodeURIComponent(run(value.substring(1), response))}`

    } else if (value) {
        return `${key}=${encodeURIComponent(value)}`
    }
}



const SimpleSlateIframe = function(template, props=[]){
    return function(body, formatting, {response, updateBody}, {IframeSelector}){
        const [properties, setProperties] = useState(body?.properties)

        const query = useIframeQuery(body, response, (properties) => {
            var serializedProperties = []

            props.forEach(prop => {
                if (properties[prop.id] !== undefined){
                    serializedProperties.push(`${prop.id}=${properties[prop.id]}`)

                } else if (prop.forceParameter && prop.kind === 'boolean'){
                    serializedProperties.push(`${prop.id}=false`)
                }
            })

            return serializedProperties.join('&')
        })

        if (body?.properties && query === undefined)
            return <div className="pt-2 mx-auto"><LoadingSpinner /></div>

        return <div className='h-full'>
            {/* Bad way to figure out if this is editable or render */}
            {IframeSelector ? <IframeSelector /> : null}
            <iframe src={`${slateHost}/show?template=${template}&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
        </div>
    }
}


const ArrayType = function(body, formatting, {response, updateBody}, {IframeSelector}){
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
        {updateBody || IframeSelector ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=array&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


let numberlineUpdateTimeout
const Numberline = function(body, formatting, {updateBody}, {IframeSelector}){
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
        {updateBody || IframeSelector ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=numberline&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


const MultipleChoice = function(body, formatting, {updateBody, response, stepID}, {IframeSelector}){
    // Example: option=asd&option=qwer&option=zxc&option=yuop
    const [properties, setProperties] = useState(body?.properties)

    const query = useIframeQuery(body, response, (properties) => {
        var serializedChoices = [], {option, shuffle, optionsDisplayColumns, question} = properties
            // propertiesAsArray = Object.keys(properties).map(
            //     p => properties[p]),
            // choices = propertiesAsArray.find(property => property.id === 'choices')?.value,
            // shuffle = propertiesAsArray.find(property => property?.id === 'shuffle')?.value

        if (option){
            var choicesAsArray = option
            if (!(option instanceof Array)){
                choicesAsArray = Object.keys(option)?.map(
                    id => option[id]).sort((a, b) => a.position - b.position)
            }

            if (choicesAsArray.length){
                choicesAsArray.forEach(choice => {
                    var serializeOption, serializedProperty
                    if (typeof(choice) === 'object'){
                        serializeOption = serializeProperty('option', `${choice.value}`, response),
                        serializedProperty = serializeOption + `�${choice.id}`
                    } else {
                        serializedProperty = serializeProperty('option', choice, response)
                    }

                    if (serializeOption !== 'option=undefined' && serializeOption !== 'option=null')
                        serializedChoices.push(serializedProperty)
                })
            }
        }

        if (!updateBody && (shuffle !== undefined)){
            serializedChoices.push(`shuffle=${shuffle}`)
        }

        if (!updateBody && (question !== undefined)){
            serializedChoices.push(`question=${question}`)
        }

        if (!updateBody && (optionsDisplayColumns !== undefined)){
            serializedChoices.push(`optionsDisplayColumns=${optionsDisplayColumns}`)
        }

        return serializedChoices.join('&')
    })

    if (body?.properties && query === undefined)
        return <div className="pt-2 mx-auto"><LoadingSpinner /></div>

    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody || IframeSelector ? <IframeSelector /> : null}
        <iframe src={`${slateHost}/show?template=multiple-choice&${query || ''}`} style={{ width: '100%', height: '100%' }}/>
    </div>
}


/* DESIGNABLE CONTENT-TYPES BELOW */

const BasicDesignableContentType = function(body, formatting, {response, updateBody }, { ImageLibrary, imageLibraryProps, IframeSelector, DesignSelector }, templateName, progressMergingFn){
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

    /* appID={appID} flowID={flowID} stepID={stepID}*/
    return <div className='h-full'>
        {/* Bad way to figure out if this is editable or render */}
        {updateBody ? <DesignSelector onClick={e => {
            setDesignOpen(iframeSrc + '&mode=design')
            e.stopPropagation()
        }} /> : null}
        {updateBody || IframeSelector ? <IframeSelector /> : null}
        <iframe src={iframeSrc} allowFullScreen style={{ width: '100%', height: '100%' }}/>
        <DesignSlatePopup open={designOpen} setOpen={setDesignOpen}
            onSave={query => {
                updateBody({ ...body, query })
            }} template={templateName}
            imageLibraryProps={imageLibraryProps}
            ImageLibrary={ImageLibrary}
        />
    </div>
}


const DragIntoSlots = function(body, formatting, {response, updateBody, name, appID, flowID, stepID}, { ImageLibrary, imageLibraryProps, IframeSelector }){
    return BasicDesignableContentType(...[...arguments].slice(0, 4), 'drag-into-slots', (query) => {
        if (query && !updateBody && response){
            var updatedQuery = new URLSearchParams(query)

            var slots = updatedQuery.getAll('slot').map(slot => JSON.parse(slot)),
                pieces = updatedQuery.getAll('piece').map(piece => JSON.parse(piece))

            if (response[`{${name}}.filledSlots`] && response[`{${name}}.filledSlots`].length){
                response[`{${name}}.filledSlots`].forEach(filledSlot => {
                    // Find the piece.
                    var pieceToSet = pieces.find(piece => filledSlot.piece === piece.name)

                    // Set it on the particular slot.
                    var correctSlot = slots.find(slot => filledSlot.slot === slot.name)
                    if (correctSlot && pieceToSet){
                        correctSlot.piece = pieceToSet
                    }
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


const InteractiveVideo = function(body, formatting, {response, updateBody}, { ImageLibrary, imageLibraryProps, IframeSelector }){
    return BasicDesignableContentType(...[...arguments].slice(0, 4), 'interactive-video')
}


const Hotspots = function(body, formatting, {response, updateBody}, { ImageLibrary, imageLibraryProps, IframeSelector }){
    return BasicDesignableContentType(...[...arguments].slice(0, 4), 'hotspots')
}


const DesignSlatePopup = function({ open, setOpen, onSave, template, imageLibraryProps, ImageLibrary /*appID, flowID, stepID*/ }){
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
                        {ImageLibrary ? <div className="flex-auto">
                            <button
                              type="button"
                              className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                              onClick={() => setOpenLibrary(true)}
                            >
                              Open image library
                            </button>
                        </div> : null}
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

        {ImageLibrary ? <ImageLibrary open={openLibrary} setOpen={setOpenLibrary}
            {...imageLibraryProps} /> : null}
        {/*<ImageLibrary open={openLibrary} setOpen={setOpenLibrary}
            appID={appID} flowID={flowID} stepID={stepID} />*/}
    </div>
}


const contentTypeProperties = {
    'die': [
        {
            id: 'number', title: 'Number on the die', kind: 'number'
        }
    ],
    'timer': [
        {
            id: 'time', title: 'Time', kind: 'number'
        }
    ],
    'hide-zero-cards': [
        {
            id: 'default', title: 'Default number', kind: 'number'
        }
    ],
    'object-length-with-centimeter-cubes': [
        {
            id: 'object', title: 'Object Image URL', kind: 'string'
        },
        {
            id: 'fixedDropbox', title: 'Can drop only inside fixed area', kind: 'boolean', forceParameter: true
        },
        {
            id: 'width', title: 'Width', kind: 'string'
        }
    ],
    'fill-in-the-blanks': [
        {
            id: 'pre', title: 'Text before the blank', kind: 'string'
        },
        {
            id: 'post', title: 'Text after the blank', kind: 'string'
        }
    ],
    'short-response': [
        {
            id: 'prompt', title: 'Prompt', kind: 'string'
        }
    ]
}


export const SLATE_CONTENT_TYPES = [
    {
        name: 'Array',
        template: 'array',
        properties: [
            {
                id: 'number', title: 'Number of boxes', kind: 'string'
            }
        ],
        responseProperties: ['columns', 'rows', 'remainder'],
        component: ArrayType
    },
    {
        name: 'Numberline',
        template: 'numberline',
        component: Numberline,
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
    },
    {
        name: 'Multiple choice answer',
        template: 'multiple-choice',
        component: MultipleChoice,
        properties: [
            { id: 'question', kind: 'string', title: 'Question' },
            {
                id: 'option', title: 'Choices', kind: 'list', items: {
                    kind: 'string', title: 'Option'
                }
            },
            { id: 'shuffle', kind: 'boolean', title: 'Shuffle order for students' },
            { id: 'optionsDisplayColumns', kind: 'number', title: 'Number of columns to display options in' }
        ],
        responseProperties: [['selected', { 0: ['id', 'content', 'index']} ]],
    },
    {
        name: 'Drag into slots',
        template: 'drag-into-slots',
        component: DragIntoSlots,
        designable: true,
        responseProperties: [['filledSlots', ['slot', 'piece']]],
    },
    {
        name: 'Interactive video',
        template: 'interactive-video',
        component: InteractiveVideo,
        designable: true,
        responseProperties: [['completedPrompts', ['label', 'response']]],
    },
    {
        name: 'Hotspots',
        template: 'hotspots',
        component: Hotspots,
        designable: true,
    },
    {
        name: 'Die',
        template: 'die',
        component: SimpleSlateIframe('die', contentTypeProperties['die']),
        properties: contentTypeProperties['die']
    },
    {
        name: 'Draw',
        template: 'draw',
        component: SimpleSlateIframe('draw')
    },
    {
        name: 'Timer',
        template: 'timer',
        component: SimpleSlateIframe('timer', contentTypeProperties['timer']),
        properties: contentTypeProperties['timer']
    },
    {
        name: 'Hide Zero Cards',
        template: 'hide-zero-cards',
        component: SimpleSlateIframe('hide-zero-cards', contentTypeProperties['hide-zero-cards']),
        properties: contentTypeProperties['hide-zero-cards']
    },
    {
        name: 'Object Length With Centimeter Cubes',
        template: 'object-length-with-centimeter-cubes',
        component: SimpleSlateIframe('object-length-with-centimeter-cubes', contentTypeProperties['object-length-with-centimeter-cubes']),
        properties: contentTypeProperties['object-length-with-centimeter-cubes']
    },
    {
        name: 'Fill in the blanks',
        template: 'fill-in-the-blanks',
        component: SimpleSlateIframe('fill-in-the-blanks', contentTypeProperties['fill-in-the-blanks']),
        properties: contentTypeProperties['fill-in-the-blanks']
    },
    {
        name: 'Short response',
        template: 'short-response',
        component: SimpleSlateIframe('short-response', contentTypeProperties['short-response']),
        properties: contentTypeProperties['short-response']
    }
]
