import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import React, { useState, useEffect, useRef } from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, writeBatch } from "firebase/firestore"
import GridLayout from "react-grid-layout"
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import {Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import styles from '../../../../../../../styles/components/StepAdmin.module.sass'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { v4 as uuidv4 } from 'uuid'
import 'draft-js/dist/Draft.css';
import {blockStyleFn} from '../../../../../../../utils/common.tsx'
import { ArrowUpIcon, ArrowDownIcon, ChevronRightIcon, HomeIcon } from '@heroicons/react/24/solid'
import update from 'immutability-helper'
import Link from 'next/link'


const StepWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!(app && app.db))
        return null

    if (!router.query.stepid)
        return null

    return <div>
        <StepDraggable db={app.db} userID={userID} />
    </div>
}


const initialLayout = [
  { i: "a", x: 0, y: 0, w: 1, h: 2 },
  { i: "b", x: 1, y: 0, w: 3, h: 2 },
  { i: "c", x: 4, y: 0, w: 1, h: 2 }
];


const StepDraggable = (props) => {
    return <DndProvider backend={HTML5Backend}>
        <Step {...props} />
    </DndProvider>;
}


const Step: NextPage = ({ db, userID }) => {
    const [layout, setLayout] = useState(null)
    const [responseChangeOpen, setResponseChangeOpen] = useState(false)
    const [selectedResourceTemplateItems, setSelectedResourceTemplateItems] = useState([])

    const [responseCheck, setResponseCheck] = useState(null)
    const responseCheckRef = useRef(null)

    const [layoutContent, setLayoutContent] = useState({})
    const layoutContentRef = useRef(null)

    const [selectedContent, setSelectedContent] = useState()

    const [contentFormatting, setContentFormatting] = useState(null)
    const contentFormattingRef = useRef(null)

    const [isContentBeingDragged, setIsContentBeingDragged] = useState(false)

    const router = useRouter()

    var setInitialData = (docSnapshot) => {
        var snapshotData = docSnapshot.data()

        setLayout({ body: snapshotData.layout ? JSON.parse(snapshotData.layout) : initialLayout })

        if (snapshotData.layoutContent)
            setLayoutContent(JSON.parse(snapshotData.layoutContent))

        if (snapshotData.responseCheck)
            setResponseCheck(snapshotData.responseCheck)

        if (snapshotData.contentFormatting)
            setContentFormatting(snapshotData.contentFormatting)
    }

    useEffect(() => {
        if (router.query.stepid === 'new'){
            // Create a new step.

            // If there is a duplicate param, use that to make this new step.
            var newStepID = uuidv4().substring(0, 8)

            getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                var flowSteps = []
                docsSnapshot.forEach(doc => flowSteps.push({ id: doc.id, ...doc.data() }))
                var sortedFlowSteps = flowSteps.sort((a, b) => a.position - b.position)

                if (router.query.duplicate){
                    if (router.query.fromFlow){
                        getDoc(doc(db, "flows", router.query.fromFlow, 'steps', router.query.duplicate)).then(docSnapshot => {
                            setDoc(doc(db, "flows", router.query.flowid, 'steps', newStepID), {
                                ...docSnapshot.data(),
                                position: (
                                    sortedFlowSteps.length ? (sortedFlowSteps[sortedFlowSteps.length - 1].position + 1) : 0
                                )
                            }).then(() => {
                                router.replace(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/${newStepID}`)
                            })
                        })

                    } else {
                        var duplicatable = flowSteps.find(step => step.id === router.query.duplicate)
                        var stepsAfterDuplicatable = flowSteps.filter(step => step.position > duplicatable.position)

                        const batch = writeBatch(db)
                        stepsAfterDuplicatable.forEach(step => {
                            updateDoc(doc(db, "flows", router.query.flowid, 'steps', step.id), { position: step.position + 1 })
                        })

                        var newStepData = { ...duplicatable, position: duplicatable.position + 1 }
                        delete newStepData.id
                        setDoc(doc(db, "flows", router.query.flowid, 'steps', newStepID), newStepData)
                        batch.commit().then(() => {
                            router.replace(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/${newStepID}`)
                        })
                    }

                } else {
                    setDoc(doc(db, "flows", router.query.flowid, 'steps', newStepID), { position: (
                            sortedFlowSteps.length ? (sortedFlowSteps[sortedFlowSteps.length - 1].position + 1) : 0
                        ) }).then(() => {
                        router.replace(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/${newStepID}`)
                    })
                }
            })

        } else {
            getDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setInitialData(docSnapshot)
                }
            })
        }
    }, [router.query.stepid])


    useEffect(() => {
        if (layout && layout.changed && layout.body){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                layout: JSON.stringify(layout.body)
            })
            setLayout({ ...layout, changed: false })
        }
    }, [layout])

    useEffect(() => {
        if (Object.keys(layoutContent).length && JSON.stringify(layoutContentRef.current) !== JSON.stringify(layoutContent)){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                layoutContent: JSON.stringify(layoutContent)
            })
        }

        layoutContentRef.current = { ...layoutContent }
    }, [layoutContent])

    useEffect(() => {
        if (responseCheck && responseCheckRef.current !== responseCheck){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {responseCheck})
        }

        responseCheckRef.current = responseCheck
    }, [responseCheck])

    useEffect(() => {
        if (contentFormatting && responseCheckRef.current !== contentFormatting){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {contentFormatting})
        }

        contentFormattingRef.current = contentFormatting
    }, [contentFormatting])

    var updateLayoutContent = (id, value) => {
        if (value){
            if (layoutContent.hasOwnProperty(id)){
                layoutContent[id] = { ...layoutContent[id], ...value }
            } else {
                layoutContent[id] = value
            }
        } else {
            if (contentFormatting.hasOwnProperty(layoutContent[id].name)){
                var newContentFormatting = {...contentFormatting}
                delete newContentFormatting[layoutContent[id].name]
                setContentFormatting(newContentFormatting)
            }

            delete layoutContent[id]
        }
        setLayoutContent({ ...layoutContent })
    }

    var toggleSelectedContent = (content) => {
        setSelectedContent(selected => {
            if (content === selected){
                return
            } else {
                return content
            }
        })
    }

    var onDragContentBegin = () => {
        setIsContentBeingDragged(true)
    }

    var onDragContentEnd = () => {
        setIsContentBeingDragged(false)
    }

    const pages = [
      { name: 'App', href: `/admin/app/${router.query.appid}`, current: false },
      { name: 'Flow', href: `/admin/app/${router.query.appid}/flow/${router.query.flowid}`, current: false },
      { name: 'Step', href: `/admin/app/${router.query.appid}/flow/${router.query.flowid}/${router.query.stepid}`, current: true },
    ]

    return <div>
        <nav className="flex" aria-label="Breadcrumb">
          <ol role="list" className="flex items-center space-x-4">
            <li>
              <div>
                <Link href="/admin"><a className="text-gray-400 hover:text-gray-500">
                  <HomeIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Home</span>
                </a></Link>
              </div>
            </li>
            {pages.map((page) => (
              <li key={page.name}>
                <div className="flex items-center">
                  <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-gray-400" aria-hidden="true" />
                  <Link href={page.href}><a
                    className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                    aria-current={page.current ? 'page' : undefined}
                  >
                    {page.name}
                  </a></Link>
                </div>
              </li>
            ))}
          </ol>
        </nav>

        <button className='p-2' onClick={() => setLayout(initialLayout)}>Reset layout</button>
        <ul>
            <li><DraggableContent name='Prompt' onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} /></li>
            <li><DraggableContent name='Question' onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} /></li>
            <li><DraggableContent name='Response' onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} /></li>
            <li><DraggableContent name='Check answer' onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} /></li>
        </ul>

        <div
          className="droppable-element"
          draggable={true}
          unselectable="on"
          // this is a hack for firefox
          // Firefox requires some kind of initialization
          // which we can do by adding this attribute
          // @see https://bugzilla.mozilla.org/show_bug.cgi?id=568313
          onDragStart={e => e.dataTransfer.setData("text/plain", "")}
        >
          Droppable Element (Drag me!)
        </div>


        {layout ? <div className={styles.GridLayoutWrapper + ' bg-slate-100'} style={{ width: '800px' }}>
            <GridLayout
              className="layout"
              layout={layout.body}
              onLayoutChange={(newLayout) => {
                  if (JSON.stringify(newLayout) !== JSON.stringify(layout.body))
                      setLayout({ body: newLayout, changed: true })
              }}
              cols={12}
              rowHeight={30}
              width={800}
              onDrop={(newLayout, layoutItem) => {
                  var indexOfNewLayoutItem = newLayout.indexOf(layoutItem)
                  newLayout[indexOfNewLayoutItem] = {
                      ...newLayout[indexOfNewLayoutItem], i: uuidv4().substring(0, 4)
                  }
                  delete newLayout[indexOfNewLayoutItem].isDraggable
                  setLayout({ body: newLayout, changed: true })
              }}
              isDroppable={!isContentBeingDragged}
            >
                {layout.body.map(box => <div key={box.i}>
                    <DroppableContentContainer id={box.i}
                        changeResponseFormat={() => setResponseChangeOpen(box.i)}
                        toggleSelectedResourceTemplateItems={item => {
                            var indexOfItem = selectedResourceTemplateItems.findIndex(i => item.id === i.id)
                            if (indexOfItem === -1){
                                setSelectedResourceTemplateItems([...selectedResourceTemplateItems, item])
                            } else {
                                setSelectedResourceTemplateItems(selectedResourceTemplateItems.filter((i, index) => index !== indexOfItem))
                            }
                        }}
                        layoutContent={layoutContent}
                        updateLayoutContent={updateLayoutContent}
                        toggleSelectedContent={toggleSelectedContent}
                        contentFormatting={contentFormatting}
                    />
                </div>)}
            </GridLayout>
            {<style jsx global>{`
                .${styles.GridLayoutWrapper} .react-grid-item {
                    border: 1px solid #000
                }
            `}</style>}
        </div> : null}
        {responseChangeOpen ? <ResponseTemplateMaker id={responseChangeOpen}
            content={layoutContent[responseChangeOpen]}
            closeChangeResponseFormat={() => setResponseChangeOpen(null)}
            updateLayoutContent={updateLayoutContent}
            toggleSelectedContent={toggleSelectedContent}
        /> : null}
        {selectedResourceTemplateItems.length ? <ExpectedResponse
            responseTemplateItems={selectedResourceTemplateItems}
            setResponseCheck={setResponseCheck}
            responseCheck={responseCheck}
        /> : null}
        {selectedContent ? <Formatting
            selectedContent={selectedContent}
            contentFormatting={contentFormatting}
            setContentFormatting={setContentFormatting}
        /> : null}
    </div>
}


const Formatting = ({ selectedContent, contentFormatting, setContentFormatting }) => {
    var properties =  [
        { name: 'Font size', property: 'fontSize', type: 'text', valueType: 'number' },
        { name: 'Text align', property: 'textAlign', type: 'select', valueType: 'string' },
        { name: 'Inline', property: 'display', type: 'checkbox', valueType: 'string', selectedValue: 'inline-block' }
    ]

    return <div>EDIT FORMATTING for {selectedContent}
        {properties.map((prop, i) => <FormattingProperty {...prop} key={i}
            content={selectedContent}
            update={(property, value) => {
                var newFormatting = { ...(contentFormatting || {}), [selectedContent] : {
                    ...(contentFormatting && contentFormatting[selectedContent] ? contentFormatting[selectedContent] : {}),
                }}

                if (value !== undefined){
                    newFormatting[selectedContent][property] = value
                } else if (newFormatting[selectedContent].hasOwnProperty(property)){
                    delete newFormatting[selectedContent][property]

                    if (!Object.keys(newFormatting[selectedContent]).length){
                        delete newFormatting[selectedContent]
                    }
                }

                setContentFormatting(newFormatting)

            }}
            value={contentFormatting && contentFormatting[selectedContent] && contentFormatting[selectedContent][prop.property]}
        />)}
    </div>
}


const FormattingProperty = ({ content, name, property, type, valueType, selectedValue, value, update }) => {
    const contentRef = useRef(null),
          elRef = useRef(null)

    useEffect(() => {
      if (content && contentRef.current !== content){
          if (value){
              elRef.current.value = valueType === 'number' ? value && parseFloat(value) : value
          } else {
              elRef.current.value = null

              if (elRef.current.type === 'checkbox'){
                  elRef.current.checked = false
              }
          }
      }

      contentRef.current = content
    }, [content])

    var applyFormatting = (e) => {
      var value = e.target.value
      if (property === 'fontSize'){
          value = parseFloat(value)
      }

      if (e.target.type === 'checkbox'){
          value = e.target.checked ? selectedValue : null
      }

      if (value){
          if (property === 'fontSize'){
              value = value + 'px'
          }

          update(property, value)

      } else {
          // Naively remove the property.
          // This isn't always going to be a good idea, such as making
          // something 0 or false might actually be desired.
          // This code would need to be adjusted in that scenario, taking
          // into account the specific property.
          update(property)
      }
    }

     var body;
     if (type === 'text'){
         body = <input type='text' ref={elRef}
            defaultValue={valueType === 'number' ? value && parseFloat(value) : value}
            onChange={applyFormatting}
        />
    } else if (type === 'select'){
        body = <select defaultValue={value} ref={elRef}
            onChange={applyFormatting}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
        </select>
    } else if (type === 'checkbox'){
        body = <input type='checkbox' ref={elRef}
            defaultChecked={value}
            onChange={applyFormatting}
        />
    }

    return <div>
        <div>{name}</div>
        {body}
    </div>
}


const DraggableContent = ({ name, onDragBegin, onDragEnd }) => {
    const [{opacity}, dragRef] = useDrag(() => ({
        type: 'content',
        item: () => {
            onDragBegin()
            return { id: name }
        },
        end: onDragEnd,
        collect: (monitor) => ({
            opacity: monitor.isDragging() ? 0.5 : 1
        }),
    }), [])

    return (
        <div ref={dragRef} style={{ opacity }}>
            {name}
        </div>
    )
}


const DroppableContentContainer = ({ id,
        changeResponseFormat, toggleSelectedResourceTemplateItems,
        updateLayoutContent, layoutContent, toggleSelectedContent,
        contentFormatting
    }) => {
    const [{ canDrop, isOver }, dropRef] = useDrop(() => ({
        accept: 'content',
        drop: (item) => {
            var numberOfSuchContentAlreadyCreated = 0
            for (var layoutID in layoutContent){
                var nameMatch = layoutContent[layoutID].name.match(new RegExp(`${item.id} (?<number>\\d)`))
                if (nameMatch){
                    numberOfSuchContentAlreadyCreated = nameMatch.groups.number
                } else if (layoutContent[layoutID].name === item.id){
                    numberOfSuchContentAlreadyCreated = 1
                }
            }

            updateLayoutContent(id, { name: numberOfSuchContentAlreadyCreated ? (
                `${item.id} ${numberOfSuchContentAlreadyCreated + 1}`) : item.id })
            return ({ name: 'Droppable-Content' });
        },
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
      }),
    }))

    return <div ref={dropRef}>
        {layoutContent.hasOwnProperty(id) ? <div>
            <EditableContent content={layoutContent[id]} id={id}
                toggleSelectedResourceTemplateItems={toggleSelectedResourceTemplateItems}
                updateLayoutContent={updateLayoutContent}
                toggleSelectedContent={toggleSelectedContent}
                contentFormatting={contentFormatting}
            />
            <button onClick={() => updateLayoutContent(id)}>Remove</button>
            {layoutContent[id].name.startsWith('Response') ? <button onClick={changeResponseFormat}>Change format</button> : null}
        </div> : 'Drop'}
    </div>
}


const EditableContent = ({ content, id, toggleSelectedResourceTemplateItems, updateLayoutContent, toggleSelectedContent, contentFormatting }) => {
    var body = content.name;
    if (content.name.startsWith('Response')){
        body = <ResponseTemplate
            id={id}
            content={content && content.body}
            toggleSelectedResourceTemplateItems={toggleSelectedResourceTemplateItems}
            updateLayoutContent={updateLayoutContent}
        />
    } else if (content.name !== 'Check answer'){
        body = <ContentInput name='text' body={content.body} formatting={contentFormatting && contentFormatting[content.name]} updateBody={(body) => {
            updateLayoutContent(id, { body })
        }} />
    }

    return <div style={{ border: '5px solid green', cursor: 'pointer',
        ...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {}),
    }} onClick={() => {
        toggleSelectedContent(content.name)
    }}>
        {body}
    </div>
}


const ResponseTemplateMaker = ({ id, closeChangeResponseFormat, updateLayoutContent, content, toggleSelectedContent }) => {
    return <div>
        make response template:
        <div>
            <button onClick={() => {
                updateLayoutContent(id, { body: [...(content.body || []), { kind: 'responsespace', id: 'item_' + uuidv4().substring(0, 7) }]})
            }}>Add response space</button>
            <button onClick={() => {
                updateLayoutContent(id, { body: [...(content.body || []), { kind: 'text', id: 'item_' + uuidv4().substring(0, 7) }]})
            }}>Add text</button>
        </div>
        <ResponseTemplate
            id={id}
            content={content.body}
            updateLayoutContent={updateLayoutContent}
            toggleSelectedContent={toggleSelectedContent}
        />
        <button onClick={() => {
            closeChangeResponseFormat()
        }}>Done</button>
    </div>
}


const ResponseTemplate = ({ id, content, responseItemSelected, toggleSelectedResourceTemplateItems, updateLayoutContent, toggleSelectedContent }) => {
    // This is a temp hack variable.
    var isInsideContentLayout = toggleSelectedResourceTemplateItems

    return <div>
        {content && content.map((responseItem, i) => <div key={i} className='flex' onClick={toggleSelectedResourceTemplateItems  ? () => toggleSelectedResourceTemplateItems(responseItem) : null} >
            {isInsideContentLayout ? null : <div>
                {i ? <button
                    onClick={() => updateLayoutContent(id, { body: update(content, {
                        $splice: [
                            [i, 1],
                            [i - 1, 0, content[i]]
                        ]
                    }) })}
                    type="button"
                  className="inline-flex items-center px-1.5 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowUpIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
                </button> : null}
                {i !== content.length - 1 ? <button
                    onClick={() => updateLayoutContent(id, { body: update(content, {
                        $splice: [
                            [i, 1],
                            [i + 1, 0, content[i]]
                        ]
                    }) })}

                    type="button"
                  className="inline-flex items-center px-1.5 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowDownIcon className="-ml-0.5 h-4 w-4" aria-hidden="true" />
                </button> : null}

            </div>}

            <div className='flex-grow'>{responseItem.kind === 'text' && isInsideContentLayout ? <ContentInput name='text' body={responseItem.body} updateBody={(body) => {
                var newBody = [...content]
                newBody[i] = { ...responseItem, body }
                updateLayoutContent(id, { body: newBody })
            }} /> : <span onClick={isInsideContentLayout ? null : () => toggleSelectedContent(responseItem.id)}>{responseItem.kind}</span>} {isInsideContentLayout ? null : <span onClick={() => updateLayoutContent(id, { body: update(content, {
                    $splice: [[i, 1]]
                })
            })}>(Remove)</span>}
            </div>
        </div>)}
    </div>
}


var ContentInput = ({ name, body, updateBody, formatting }) => {
    const [editorState, setEditorState] = useState(EditorState.createEmpty())

    useEffect(() => {
        if (body){
            var newEditorState = EditorState.createWithContent(convertFromRaw(body))
            setEditorState(newEditorState)
        }
    }, [])

    return <Editor editorState={editorState}
        placeholder={`Add some ${name}`}
        blockStyleFn={blockStyleFn.bind(this, formatting)}
        onChange={(newEditorState) => {
        setEditorState(newEditorState)
    }} onBlur={() => updateBody(convertToRaw(editorState.getCurrentContent()))} />
}


const ExpectedResponse = ({ responseTemplateItems, setResponseCheck, responseCheck }) => {
    return <div>
        assess using these items:
        {responseTemplateItems.map((item, i) => <div key={i}>
            {item.id}: {item.kind}
        </div>)}
        <textarea onBlur={event => setResponseCheck(event.target.value)} defaultValue={responseCheck} />
    </div>
}


export default StepWrapper
