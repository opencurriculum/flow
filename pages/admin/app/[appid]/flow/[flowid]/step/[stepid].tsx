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

    const [isContentBeingDragged, setIsContentBeingDragged] = useState()

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

                if (router.query.duplicate){
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
                        router.replace(`/admin/app/${router.query.flowid}/flow/${router.query.flowid}/step/${newStepID}`)
                    })

                } else {
                    var sortedFlowSteps = flowSteps.sort((a, b) => a.position - b.position)

                    setDoc(doc(db, "flows", router.query.flowid, 'steps', newStepID), { duration: 0, position: sortedFlowSteps[sortedFlowSteps.length - 1].position + 1 }).then(() => {
                        router.replace(`/admin/app/${router.query.flowid}/flow/${router.query.flowid}/step/${newStepID}`)
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
        if (layoutContent.hasOwnProperty(id)){
            layoutContent[id] = { ...layoutContent[id], ...value }
        } else {
            layoutContent[id] = value
        }
        setLayoutContent({ ...layoutContent })
    }

    var applyFormatting = (prop, e) => {
        var value = e.target.value
        if (prop === 'fontSize'){
            value = parseFloat(value)
        }

        if (value){
            if (prop === 'fontSize'){
                value = value + 'px'
            }

            setContentFormatting({ ...(contentFormatting || {}), [selectedContent] : {
                ...(contentFormatting && contentFormatting[selectedContent] ? contentFormatting[selectedContent] : {}),
                [prop]: value
            }})
        }
    }

    var onDragContentBegin = () => {
        setIsContentBeingDragged(false)
    }

    var onDragContentEnd = () => {
        setIsContentBeingDragged(true)
    }

    return <div>
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
                  setLayout({ body: newLayout, changed: true })
              }}
              isDroppable={isContentBeingDragged}
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
                        toggleSelectedContent={(content) => {
                            setSelectedContent(selected => {
                                if (content === selected){
                                    return
                                } else {
                                    return content
                                }
                            })
                        }}
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
            closeChangeResponseFormat={() => setResponseChangeOpen(null)}
            updateLayoutContent={updateLayoutContent}
        /> : null}
        {selectedResourceTemplateItems.length ? <ExpectedResponse
            responseTemplateItems={selectedResourceTemplateItems}
            setResponseCheck={setResponseCheck}
            responseCheck={responseCheck}
        /> : null}
        {selectedContent ? <div>EDIT FORMATTING for {selectedContent}
            <div>Font size</div>
            <input type='text' defaultValue={contentFormatting && contentFormatting[selectedContent] && contentFormatting[selectedContent].fontSize && parseFloat(contentFormatting[selectedContent].fontSize)}
                onChange={applyFormatting.bind(this, 'fontSize')}/>

            <div>Text align</div>
            <select defaultValue={contentFormatting && contentFormatting[selectedContent] && contentFormatting[selectedContent].textAlign}
                onChange={applyFormatting.bind(this, 'textAlign')}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
            </select>

        </div> : null}
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
            updateLayoutContent(id, { name: item.id })
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
            {layoutContent[id].name === 'Response' ? <button onClick={changeResponseFormat}>Change format</button> : null}
        </div> : 'Drop'}
    </div>
}


const EditableContent = ({ content, id, toggleSelectedResourceTemplateItems, updateLayoutContent, toggleSelectedContent, contentFormatting }) => {
    var body = content.name;
    if (content.name === 'Response'){
        body = <ResponseTemplate
            id={id}
            content={content}
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


const ResponseTemplateMaker = ({ id, closeChangeResponseFormat, updateLayoutContent }) => {
    const [responseTemplate, setResponseTemplate] = useState([
        { kind: 'responsespace', id: 'item_' + uuidv4().substring(0, 7) }
    ])

    return <div>
        make response template:
        <div>
            <button onClick={() => {
                setResponseTemplate([...responseTemplate, { kind: 'responsespace', id: 'item_' + uuidv4().substring(0, 7) }])
            }}>Add response space</button>
            <button onClick={() => {
                setResponseTemplate([...responseTemplate, { kind: 'text', id: 'item_' + uuidv4().substring(0, 7) }])
            }}>Add text</button>
        </div>
        <ResponseTemplate template={responseTemplate} />
        <button onClick={() => {
            updateLayoutContent(id, { body: responseTemplate })
            closeChangeResponseFormat()
        }}>Done</button>
    </div>
}


const ResponseTemplate = ({ id, content, responseItemSelected, toggleSelectedResourceTemplateItems, updateLayoutContent }) => {
    return <div>
        {content.body && content.body.map((responseItem, i) => <div key={i} onClick={() => toggleSelectedResourceTemplateItems(responseItem)}>
            {responseItem.kind === 'text' ? <ContentInput name='text' body={responseItem.body} updateBody={(body) => {
                var newBody = [...content.body]
                newBody[i] = { ...responseItem, body }
                updateLayoutContent(id, { body: newBody })
            }} /> : responseItem.kind}
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
