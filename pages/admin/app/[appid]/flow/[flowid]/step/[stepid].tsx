import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import React, { useState, useEffect, useRef } from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, writeBatch, deleteField, deleteDoc } from "firebase/firestore"
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
import {
    blockStyleFn, applyExperimentToLayoutContent,
    applyExperimentToContentFormatting, applyExperimentToLayout
} from '../../../../../../../utils/common.tsx'
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


const initialExperiment = (router) => ({
    groups: [{
        name: 'A',
        weight: 0.5,
        steps: {
            [router.query.stepid]: []
        }
    }, {
        name: 'B',
        weight: 0.5,
        steps: {
            [router.query.stepid]: []
        }
    }]
})


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

    const [flow, setFlow] = useState()
    const [experiment, setExperiment] = useState()
    const experimentRef = useRef()

    var nameRef = useRef()

    const router = useRouter()

    useEffect(() => {
        if (flow){
            if (!experiment){
                if (flow.experiment){
                    // Get the experiment and initialize it.
                    getDoc(flow.experiment).then(docSnapshot => {
                        const data = docSnapshot.data()
                        experimentRef.current = { ...data, id: docSnapshot.id }

                        if (router.query.group)
                            experimentRef.current.current = router.query.group

                        setExperiment(experimentRef.current)

                        const url = new URL(window.location.href)
                        searchParams.set('group', data.groups[0].name)
                        url.search = new URLSearchParams(searchParams)

                        router.replace(url.toString())
                    })

                } else if (router.query.group){
                    // Create the experiment and attach it to the flow.
                    setExperiment({
                        ...initialExperiment(router),
                        current: router.query.group
                    })
                }

            } else {
                if (!router.query.group){
                    const url = new URL(window.location.href)
                    searchParams.set('group', experiment.groups[0].name)
                    url.search = new URLSearchParams(searchParams)

                    router.replace(url.toString())
                }

                if (router.query.group !== experiment.current){
                    experimentRef.current = { ...experiment, current: router.query.group }
                    setExperiment(experimentRef.current)
                }

            }
        }

    }, [flow, router.query.group])

    useEffect(() => {
        if (experimentRef.current !== experiment){
            // Save the parts that need to be persisted.

            if (!experiment && experimentRef.current.id){
                updateDoc(doc(db, "flows", router.query.flowid), { experiment: deleteField() })
                console.log(experimentRef.current.id)
                deleteDoc(doc(db, "experiments", experimentRef.current.id))

                experimentRef.current = experiment

                const url = new URL(window.location.href)
                searchParams.delete('group')
                url.search = new URLSearchParams(searchParams)

                router.push(url.toString())

            } else if (experiment.id){
                updateDoc(doc(db, "experiments", experiment.id), update(experiment, { $unset: ['current', 'id'] }))
                experimentRef.current = experiment

            } else {
                var id = uuidv4().substring(0, 8),
                    newExperimentDoc = doc(db, "experiments", id)
                setDoc(newExperimentDoc, update(experiment, { $unset: ['current', 'id'] }))
                updateDoc(doc(db, "flows", router.query.flowid), { experiment: newExperimentDoc })

                experimentRef.current = { ...experiment, id }
                setExperiment(experimentRef.current)
            }
        }
    }, [experiment])


    var setInitialData = (docSnapshot) => {
        var snapshotData = docSnapshot.data()
        nameRef.current.value = snapshotData.name || ''

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
        getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
            setFlow(docSnapshot.data())
        })
    }, [router.query.flowid])

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
        // If there is part of an experiment condition, set the layout content there.
        if (experiment && experiment.current !== 'All'){
            const groupIndex = experiment.groups.findIndex(group => group.name === experiment.current)

            if (!value){
                setExperiment(
                    update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'remove' }] } } } } })
                )
            } else {
                // If this is an edit.
                var editToDefault = layoutContent.hasOwnProperty(id),
                    indexOfChange = experiment.groups[groupIndex].steps[router.query.stepid].findIndex(change => change.prop === 'layoutContent' && change.op !== 'remove')

                if (indexOfChange !== -1){
                    setExperiment(
                        update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [indexOfChange]: { value: {$set: value}, prop: {$set: 'layoutContent'} }} } } } })
                    )

                } else if (editToDefault) {
                    setExperiment(
                        update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'edit', value } ] } } } } })
                    )

                // If this is an add.
                } else {
                    setExperiment(
                        update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'add', value } ] } } } } })
                    )
                }
            }

        } else {

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
      { name: 'Step', href: `/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`, current: true },
    ]

    var searchParams = new URLSearchParams(window.location.search)


    var experimentLocked = { layoutContent: [], contentFormatting: [] }
    if (experiment){
        experiment.groups && experiment.groups.forEach(group => {
            group.steps[router.query.stepid].forEach(change => {
                if (change.prop === 'layoutContent'){
                    experimentLocked.layoutContent.push(change.id)
                }
            })
        })
    }

    var experimentAppliedContentFormatting = applyExperimentToContentFormatting(contentFormatting, experiment, router.query.stepid),
        experimentAppliedLayout = applyExperimentToLayout(layout && layout.body, experiment, router.query.stepid)
console.log(experiment)

    function setExperimentLayout(newLayout){
        const groupIndex = experiment.groups.findIndex(group => group.name === experiment.current)

        var recentChangeToPropertyIndex = experiment.groups[groupIndex].steps[router.query.stepid].findIndex(
                change => change.prop === 'layout')

        if (recentChangeToPropertyIndex !== -1){
            setExperiment(
                update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [recentChangeToPropertyIndex]: { value: { $set: JSON.stringify(newLayout) } } } } } } })
            )
        } else {
            setExperiment(
                update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layout', value: JSON.stringify(newLayout) } ] } } } } })
            )
        }
    }

    return <div>
        <a href={`/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`} target="_blank" rel="noreferrer">Preview</a>


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

        <div className='max-w-xs mx-auto'>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Name
          </label>
          <div className="mt-1">
            <input
              ref={nameRef}
              type="text"
              name="name"
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              placeholder="Flow name"
              onBlur={(event) => updateDoc(doc(db, "flows", router.query.flowid, "steps", router.query.stepid), { name: event.target.value })}
            />
          </div>
        </div>

        <a onClick={() => {
            // setExperiment(initialExperiment(router))

            const url = new URL(window.location.href)
            searchParams.set('group', 'A')
            url.search = new URLSearchParams(searchParams)
            router.replace(url.toString())

        }}>Differentiate based on groups</a>

        {experiment && experiment.groups ? [{ name: 'All' }].concat(experiment.groups).map((group, i) => {
            const url = new URL(window.location.href)
            searchParams.set('group', group.name)
            url.search = new URLSearchParams(searchParams)

            return <Link href={url.toString()} key={i}>
                <a className={experiment && experiment.current === group.name ? ' font-bold' : ''}>
                    {group.name === 'All' ? group.name : `Group ${group.name}`}
                </a>
            </Link>
        }) : null}

        {experiment && experiment.groups ? <a onClick={() => {
            if (window.confirm('Are you sure you want to remove your experiment? This will delete all the changes you have made to individual groups. It will, however, preserve the "All" group')){
                setExperiment()
            }
        }}>Remove experiment</a> : null}


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
              layout={experimentAppliedLayout}
              onLayoutChange={(newLayout) => {
                  if (experiment && experiment.current !== 'All'){
                      setExperimentLayout(newLayout)
                  } else {
                      if (JSON.stringify(newLayout) !== JSON.stringify(layout.body))
                          setLayout({ body: newLayout, changed: true })
                  }
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

                  if (experiment && experiment.current !== 'All'){
                      setExperimentLayout(newLayout)
                  } else {
                      setLayout({ body: newLayout, changed: true })
                  }
              }}
              isDroppable={!isContentBeingDragged}
            >
                {experimentAppliedLayout.map(box => <div key={box.i}>
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
                        layoutContent={applyExperimentToLayoutContent(layoutContent, experiment, router.query.stepid)}
                        updateLayoutContent={updateLayoutContent}
                        toggleSelectedContent={toggleSelectedContent}
                        contentFormatting={experimentAppliedContentFormatting}
                        experimentLock={experiment && experiment.current === 'All' ? experimentLocked.layoutContent.indexOf(box.i) !== -1 : false}
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
            contentFormatting={experimentAppliedContentFormatting}
            update={(property, value) => {
                // If there is part of an experiment condition, set the changed formatting there.
                if (experiment && experiment.current !== 'All'){
                    const groupIndex = experiment.groups.findIndex(group => group.name === experiment.current)

                    if (value !== undefined){
                        var recentChangeToPropertyIndex = experiment.groups[groupIndex].steps[router.query.stepid].findIndex(
                                change => change.prop === 'contentFormatting' && change.id === selectedContent && change.value.property === property)

                        if (recentChangeToPropertyIndex !== -1){
                            setExperiment(
                                update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [recentChangeToPropertyIndex]: { op: { $set: 'change' }, value: { $set: { property, value } } } } } } } })
                            )

                        } else {
                            setExperiment(
                                update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'contentFormatting', id: selectedContent, op: 'change', value: { property, value }  }] } } } } })
                            )
                        }

                    } else {
                        setExperiment(
                            update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'contentFormatting', id: selectedContent, op: 'remove'  }] } } } } })
                        )
                    }

                } else {
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
                }

            }}
        /> : null}
    </div>
}


const Formatting = ({ selectedContent, contentFormatting, update }) => {
    var properties =  [
        { name: 'Font size', property: 'fontSize', type: 'text', valueType: 'number' },
        { name: 'Text align', property: 'textAlign', type: 'select', valueType: 'string' },
        { name: 'Inline', property: 'display', type: 'checkbox', valueType: 'string', selectedValue: 'inline-block' }
    ]

    return <div>EDIT FORMATTING for {selectedContent}
        {properties.map((prop, i) => <FormattingProperty {...prop} key={i}
            content={selectedContent}
            update={update}
            value={contentFormatting && contentFormatting[selectedContent] && contentFormatting[selectedContent][prop.property]}
        />)}
    </div>
}


const FormattingProperty = ({ content, name, property, type, valueType, selectedValue, value, update }) => {
    const contentRef = useRef(null),
          valueRef = useRef(null),
          elRef = useRef(null)

    var updateValueEls = (valueType, value) => {
        if (value){
            elRef.current.value = valueType === 'number' ? value && parseFloat(value) : value
        } else {
            elRef.current.value = null

            if (elRef.current.type === 'checkbox'){
                elRef.current.checked = false
            }
        }
    }

    useEffect(() => {
      if (content && contentRef.current !== content){
          updateValueEls(valueType, value)
      }

      contentRef.current = content
    }, [content])

    useEffect(() => {
        if (valueRef.current !== value){
            updateValueEls(valueType, value)
        }

        valueRef.current = value
    }, [value])

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
        contentFormatting, experimentLock
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
            {experimentLock ? <div>DONT TOUCH ME I AM LOCKED BY A GROUP CHANGE</div> : null}
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
    const [isEditing, setIsEditing] = useState()

    const bodyRef = useRef()

    useEffect(() => {
        if (body && body !== bodyRef.current && !isEditing){
            var newEditorState = EditorState.createWithContent(convertFromRaw(body))
            setEditorState(newEditorState)

            bodyRef.current = body
        }
    }, [body])

    return <Editor editorState={editorState}
        placeholder={`Add some ${name}`}
        blockStyleFn={blockStyleFn.bind(this, formatting)}
        onChange={(newEditorState) => {
            setIsEditing(true)
            setEditorState(newEditorState)
        }}
        onBlur={() => {
            updateBody(convertToRaw(editorState.getCurrentContent()))
            setTimeout(() => setIsEditing(false), 1)
        }} />
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
