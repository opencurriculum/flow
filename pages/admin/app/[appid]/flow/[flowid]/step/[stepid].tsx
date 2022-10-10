import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import React, { useState, useEffect, useRef } from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, writeBatch, deleteField, deleteDoc } from "firebase/firestore"
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import { v4 as uuidv4 } from 'uuid'
import {
    applyExperimentToLayoutContent,
    applyExperimentToContentFormatting, applyExperimentToLayout
} from '../../../../../../../utils/common.tsx'
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'
import update from 'immutability-helper'
import Link from 'next/link'
import Layout from '../../../../../../../components/admin-layout'
import { useFirestore } from 'reactfire'
import Head from 'next/head'
import { ExperimentHeader } from '../../../../../../../components/experimentation'
import WYSIWYGPanels, {ContentInput} from '../../../../../../../components/wysiwyg'


const initialLayout = [
  { i: "a", x: 0, y: 0, w: 1, h: 2 },
  { i: "b", x: 1, y: 0, w: 3, h: 2 },
  { i: "c", x: 4, y: 0, w: 1, h: 2 }
];


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


const Step: NextPageWithLayout = ({ userID }) => {
    const [step, setStep] = useState()

    const [layout, setLayout] = useState(null)

    const [layoutContent, setLayoutContent] = useState({})
    const layoutContentRef = useRef(null)

    const [contentFormatting, setContentFormatting] = useState(null)
    const contentFormattingRef = useRef(null)

    const [responseFormatChangeOpen, setResponseChangeFormatOpen] = useState(false)
    const [selectedResponseTemplateItems, setSelectedResponseTemplateItems] = useState([])
    const [responseCheck, setResponseCheck] = useState(null)
    const responseCheckRef = useRef(null)

    const [flow, setFlow] = useState()
    const [experiment, setExperiment] = useState()
    const experimentRef = useRef()

    const router = useRouter(),
        db = useFirestore()

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

        setStep({ name: snapshotData.name || '' })

        setLayout({ body: snapshotData.layout ? JSON.parse(snapshotData.layout) : initialLayout })

        if (snapshotData.layoutContent)
            setLayoutContent(JSON.parse(snapshotData.layoutContent))

        if (snapshotData.responseCheck)
            setResponseCheck(snapshotData.responseCheck)

        if (snapshotData.contentFormatting)
            setContentFormatting(snapshotData.contentFormatting)
    }

    useEffect(() => {
        if (router.query.stepid){
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
        }
    }, [router.query.stepid])

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                setFlow(docSnapshot.data())
            })
        }
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
        if (contentFormatting && contentFormattingRef.current !== contentFormatting){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {contentFormatting})
        }

        contentFormattingRef.current = contentFormatting
    }, [contentFormatting])

    if (!router.query.stepid)
        return null

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
                    indexOfChange = experiment.groups[groupIndex].steps[router.query.stepid].findIndex(change => change.prop === 'layoutContent' && change.id === id && change.op !== 'remove')

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

    var searchParams = new URLSearchParams(window.location.search)

    var experimentLocked = { layoutContent: [], contentFormatting: [] }
    if (experiment && experiment.current === 'All'){
        experiment.groups && experiment.groups.forEach(group => {
            group.steps[router.query.stepid].forEach(change => {
                if (change.prop === 'layoutContent'){
                    experimentLocked.layoutContent.push(change.id)
                }
            })
        })
    }

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

    var experimentAppliedContentFormatting = applyExperimentToContentFormatting(contentFormatting, experiment, router.query.stepid),
        experimentAppliedLayout = applyExperimentToLayout(layout && layout.body, experiment, router.query.stepid),
        experimentAppliedLayoutContent = applyExperimentToLayoutContent(layoutContent, experiment, router.query.stepid)


    return <div className='flex flex-col flex-auto'>
        {/*<a href={`/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`} target="_blank" rel="noreferrer">Preview</a>*/}

        <Head>
            <title>{step && step.name || 'Untitled step'}</title>
            <meta property="og:title" content={step && step.name || 'Untitled step'} key="title" />
        </Head>

        <ExperimentHeader experiment={experiment} />

        <WYSIWYGPanels context='step'
            layout={experimentAppliedLayout}
            onLayoutChange={(newLayout) => {
                if (experiment && experiment.current !== 'All'){
                    setExperimentLayout(newLayout)
                } else {
                    if (JSON.stringify(newLayout) !== JSON.stringify(layout.body))
                        setLayout({ body: newLayout, changed: true })
                }
            }}
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

            layoutContent={experimentAppliedLayoutContent}
            updateLayoutContent={updateLayoutContent}

            formatting={experimentAppliedContentFormatting}
            updateFormatting={(selectedContent, property, value) => {
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

            contentTypes={{
                'Response': {
                    editable: (id, body) => <ResponseTemplate
                        id={id}
                        content={body}
                        toggleSelectedResponseTemplateItems={item => {
                            var indexOfItem = selectedResponseTemplateItems.findIndex(i => item.id === i.id)
                            if (indexOfItem === -1){
                                setSelectedResponseTemplateItems([...selectedResponseTemplateItems, item])
                            } else {
                                setSelectedResponseTemplateItems(selectedResponseTemplateItems.filter((i, index) => index !== indexOfItem))
                            }
                        }}
                        updateLayoutContent={updateLayoutContent}
                    />,
                    option: (id) => <button onClick={() => setResponseChangeFormatOpen(id)}>Change format</button>
                },

                'Check answer': {}
            }}

            formattingPanelAdditions={(toggleSelectedContent) => [
                experiment && experiment.groups ? null : <button onClick={() => {
                    // setExperiment(initialExperiment(router))

                    const url = new URL(window.location.href)
                    searchParams.set('group', 'A')
                    url.search = new URLSearchParams(searchParams)
                    router.replace(url.toString())

                }}
                    className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"

                >Differentiate</button>,
                responseFormatChangeOpen ? <ResponseTemplateMaker id={responseFormatChangeOpen}
                    content={layoutContent[responseFormatChangeOpen]}
                    closeChangeResponseFormat={() => setResponseChangeFormatOpen(null)}
                    updateLayoutContent={updateLayoutContent}
                    toggleSelectedContent={toggleSelectedContent}
                /> : null,
                selectedResponseTemplateItems.length ? <ExpectedResponse
                    responseTemplateItems={selectedResponseTemplateItems}
                    setResponseCheck={setResponseCheck}
                    responseCheck={responseCheck}
                /> : null
            ]}

            lockedContent={experimentLocked}
        />
    </div>
}


Step.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
      {page}
    </Layout>
  )
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


const ResponseTemplate = ({ id, content, responseItemSelected, toggleSelectedResponseTemplateItems, updateLayoutContent, toggleSelectedContent }) => {
    // This is a temp hack variable.
    var isInsideContentLayout = toggleSelectedResponseTemplateItems

    return <div>
        {content && content.map((responseItem, i) => <div key={i} className='flex' onClick={toggleSelectedResponseTemplateItems ? () => toggleSelectedResponseTemplateItems(responseItem) : null} >
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


const ExpectedResponse = ({ responseTemplateItems, setResponseCheck, responseCheck }) => {
    return <div>
        <h3 className="text-lg font-medium leading-10">Check response</h3>
        {responseTemplateItems.map((item, i) => <div key={i}>
            {item.id}: {item.kind}
        </div>)}
        <textarea onBlur={event => setResponseCheck(event.target.value)} defaultValue={responseCheck} />
    </div>
}


export default Step
