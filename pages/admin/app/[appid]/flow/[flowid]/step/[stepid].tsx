import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import React, { useState, useEffect, useRef, useContext } from 'react'
import { collection, getDocs, getDoc, doc, updateDoc, setDoc, writeBatch, deleteField, deleteDoc } from "firebase/firestore"
import { logEvent } from "firebase/analytics"
import { useRouter } from 'next/router'
import { v4 as uuidv4 } from 'uuid'
import {
    applyExperimentToLayoutContent,
    applyExperimentToContentFormatting, applyExperimentToLayout,
    applyExperimentToResponseCheck
} from '../../../../../../../utils/experimentation.tsx'
import update from 'immutability-helper'
import Link from 'next/link'
import Layout from '../../../../../../../components/admin-layout'
import { useFirestore } from 'reactfire'
import Head from 'next/head'
import { ExperimentHeader } from '../../../../../../../components/experimentation'
import WYSIWYGPanels, {ContentInput} from '../../../../../../../components/wysiwyg'
import { ResponseTemplate } from '../../../../../../../components/content-types'
import { StepContentTypes, applyEventsToLayoutContent, useResponse, throttleCall } from '../../../../../../../utils/common'
import PropertyEditor from '../../../../../../../components/property-editor'
import jsonDiff from 'json-diff'
import { UserContext } from '../../../../../../_app'
import { XMarkIcon } from '@heroicons/react/20/solid'


const initialLayout = [
  // { i: "a", x: 0, y: 0, w: 1, h: 2 },
  // { i: "b", x: 1, y: 0, w: 3, h: 2 },
  // { i: "c", x: 4, y: 0, w: 1, h: 2 }
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


export const EventsHeader = ({ events }) => {
    const router = useRouter()
    var searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()

    return events?.current ? <header className="bg-red-700 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        '{events?.current}' is clicked. <span className="opacity-60 italic">Any changes you make will show once a user clicks on '{events?.current}'</span>

        <button
          type="button"
          className="inline-flex items-center rounded-md border border-transparent bg-red-700 px-2 py-1 text-sm font-medium leading-4 text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 float-right"
          onClick={() => {
             const url = new URL(window.location.href)
             searchParams.delete('event:click')
             url.search = new URLSearchParams(searchParams)

             router.push(url.toString())
         }}
        >
          <XMarkIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
          Unclick
        </button>

      </div>
    </header> : null
}


const Step: NextPageWithLayout = ({}) => {
    const [step, setStep] = useState()

    const [layout, setLayout] = useState(null)

    const [layoutContent, setLayoutContent] = useState({})
    const layoutContentRef = useRef(null)

    const [contentFormatting, setContentFormatting] = useState(null)
    const contentFormattingRef = useRef(null)

    const [responseCheck, setResponseCheck] = useState(null)
    const responseCheckRef = useRef(null)

    const [flow, setFlow] = useState()
    const [experiment, setExperiment] = useState()
    const experimentRef = useRef()

    const [events, setEvents] = useState()
    const eventsRef = useRef()

    // const [responseFormatChangeOpen, setResponseChangeFormatOpen] = useState(false)
    // const [selectedResponseTemplateItems, setSelectedResponseTemplateItems] = useState([])

    const [contentSettings, setContentSettings] = useState({})

    var searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()

    const router = useRouter(),
        db = useFirestore()

    const [response, setResponse] = useResponse(router?.query?.stepid)

    const [user, userID] = useContext(UserContext)

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
                    newExperimentDoc = doc(db, "experiments", id),
                    flowRef = doc(db, "flows", router.query.flowid)

                setDoc(newExperimentDoc, { ...update(experiment, { $unset: ['current', 'id'] }), flow: flowRef })
                updateDoc(flowRef, { experiment: newExperimentDoc })

                experimentRef.current = { ...experiment, id }
                setExperiment(experimentRef.current)
            }
        }
    }, [experiment, db])


    var queryClick = router.query['event:click']
    useEffect(() => {
        if (step){
            if (!events){
                // If existing events are not not locally initialized.
                if (step.events){
                    // Get the events and initialize it.
                    eventsRef.current = step.events

                    if (queryClick)
                        eventsRef.current.current = queryClick

                    setEvents(eventsRef.current)

                // Or just set what's current.
                } else if (router.query['event:click']){
                    setEvents({
                        current: queryClick,
                        [queryClick]: { 'click': [] }
                    })
                }

            } else {
                if (queryClick !== events.current){
                    if (queryClick){
                        eventsRef.current = {
                            ...events, current: queryClick,
                            [queryClick]: (events[queryClick] || { 'click': [] })
                        }

                    } else {
                        eventsRef.current = { ...events }
                        delete eventsRef.current.current
                    }

                    setEvents(eventsRef.current)
                }
            }
        }
    }, [step, queryClick])

    useEffect(() => {
        if (eventsRef.current !== events){
            // Save the parts that need to be persisted.
            if (!events && Object.keys(eventsRef.current).length === 1){
            //     updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), { events: deleteField() })
            //
            //     experimentRef.current = experiment
            //
            //     const url = new URL(window.location.href)
            //     searchParams.delete('group')
            //     url.search = new URLSearchParams(searchParams)
            //
            //     router.push(url.toString())
            //
            } else if (eventsRef.current){
                updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                    events: update(events, { $unset: ['current'] })
                })

                eventsRef.current = events
            //
            } else {
                eventsRef.current = { ...events }
                updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                    events: { [eventsRef.current.current]: { 'click': [] } }
                })

                setEvents(eventsRef.current)
            }
        }
    }, [events, db, router.query.flowid, router.query.stepid])




    var setInitialData = (docSnapshot) => {
        var snapshotData = docSnapshot.data()

        var step = { name: snapshotData.name || '' }
        if (snapshotData.events)
            step.events = snapshotData.events

        setStep(step)

        setLayout({ body: snapshotData.layout ? JSON.parse(snapshotData.layout) : initialLayout })

        if (snapshotData.layoutContent)
            setLayoutContent(JSON.parse(snapshotData.layoutContent))

        if (snapshotData.contentFormatting)
            setContentFormatting(snapshotData.contentFormatting)

        if (snapshotData.responseCheck)
            setResponseCheck(snapshotData.responseCheck)
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
    }, [router.query.stepid, db])

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                setFlow(docSnapshot.data())
            })
        }
    }, [router.query.flowid, db])

    useEffect(() => {
        if (layout && layout.changed && layout.body){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                layout: JSON.stringify(layout.body)
            })
            setLayout({ ...layout, changed: false })
        }
    }, [layout, db, router.query.flowid, router.query.stepid])

    useEffect(() => {
        if (layoutContentRef.current && JSON.stringify(layoutContentRef.current) !== JSON.stringify(layoutContent)){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {
                layoutContent: JSON.stringify(layoutContent)
            })
        }

        layoutContentRef.current = { ...layoutContent }
    }, [layoutContent, db, router.query.flowid, router.query.stepid])

    useEffect(() => {
        if (responseCheck && responseCheckRef.current !== responseCheck){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {responseCheck})
        }

        responseCheckRef.current = responseCheck
    }, [responseCheck, db, router.query.flowid, router.query.stepid])

    useEffect(() => {
        if (contentFormatting && contentFormattingRef.current !== contentFormatting){
            updateDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid), {contentFormatting})
        }

        contentFormattingRef.current = contentFormatting
    }, [contentFormatting, db, router.query.flowid, router.query.stepid])

    if (!router.query.stepid)
        return null



    var experimentAppliedContentFormatting = applyExperimentToContentFormatting(contentFormatting, experiment, router.query.stepid),
        experimentAppliedLayout = applyExperimentToLayout(layout && layout.body, experiment, router.query.stepid),
        experimentAppliedLayoutContent = applyEventsToLayoutContent(
            applyExperimentToLayoutContent(layoutContent, experiment, router.query.stepid), events
        ),
        experimentAppliedResponseCheck = applyExperimentToResponseCheck(responseCheck, experiment, router.query.stepid)



    var updateLayoutContent = (id, value) => {
        // Determine which wrapper the edits should go in.
        var edits, groupIndex, experimentStep,
            setEdits

        if (eventsRef.current && eventsRef.current.current){
            edits = eventsRef.current[eventsRef.current.current] && eventsRef.current[eventsRef.current.current].click

            setEdits = (change) => {
                setEvents(events => {
                    var updater = (es, c) => update(es, { [eventsRef.current.current]: { click: c } })

                    if (typeof(change) === 'function'){
                        return change(
                            events,
                            e => e[eventsRef.current.current].click,
                            // (es, c) => update(es[eventsRef.current.current].click, c)
                            updater
                        )
                    }

                    return updater(events, change)
                })
            }

        } else if (experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current),
                experimentStep = experimentRef.current.groups[groupIndex].steps[router.query.stepid]

            edits = experimentStep

            setEdits = (change) => {
                setExperiment(experiment => {
                    var updater = (es, c) => update(es, { groups: { [groupIndex]: { steps: { [router.query.stepid]: c } } } })

                    if (typeof(change) === 'function'){
                        return change(
                            experiment,
                            (e) => e.groups[groupIndex].steps[router.query.stepid],
                            updater
                        )
                    }

                    return updater(experiment, change)
                })
            }
        }

        /* Determine the last content value to see if there has been a change from it.*/
        var lastEdit
        if (eventsRef.current && eventsRef.current.current){
            lastEdit = eventsRef.current[eventsRef.current.current] && eventsRef.current[eventsRef.current.current].click.reverse(
                ).find(change => change.prop === 'layoutContent' && change.id === id && change.op !== 'remove')
        }
        if (!lastEdit && experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current),
                experimentStep = experimentRef.current.groups[groupIndex].steps[router.query.stepid]

            lastEdit = experimentStep.reverse().find(
                change => change.prop === 'layoutContent' && change.id === id && change.op !== 'remove')
        }
        if (!lastEdit && layoutContent.hasOwnProperty(id)){
            lastEdit = layoutContent[id]
        }
        if (lastEdit && value?.body?.hasOwnProperty('entityMap')){
            if (!jsonDiff.diff(lastEdit.body, value?.body)){
                return
            }
        }
        /* End of last edit determination */

        // If there is part of an experiment condition, set the layout content there.
        if (edits){
            if (!value){
                // If this was added as a part of the experiment, remove all the
                var addEdits = edits.filter(change => change.prop === 'layoutContent' && change.id === id && ['add', 'edit'].indexOf(change.op) !== -1)

                if (addEdits.length){
                    setEdits((edits, finder, updater) => {
                        var updatedEdits = edits, indexOfAddEdit

                        addEdits.forEach(addEdit => {
                            indexOfAddEdit = finder ? finder(updatedEdits) : updatedEdits.indexOf(addEdit)
                            updatedEdits = updater(updatedEdits, {$splice: [[indexOfAddEdit, 1]] })
                        })

                        return updatedEdits
                    })

                } else {
                    // Else, remove it from the main step.
                    setEdits({$push: [{ prop: 'layoutContent', id, op: 'remove' }]})
                }

            } else {
                // If this is an edit.
                var editToDefault = experimentAppliedLayoutContent.hasOwnProperty(id),
                    indexOfChange = edits.findIndex(change => change.prop === 'layoutContent' && change.id === id && change.op !== 'remove')

                if (indexOfChange !== -1){
                    setEdits({ [indexOfChange]: { value: {$merge: value}, prop: {$set: 'layoutContent'} }})

                } else if (editToDefault) {
                    setEdits({$push: [{ prop: 'layoutContent', id, op: 'edit', value } ] })

                // If this is an add.
                } else {
                    setEdits({$push: [{ prop: 'layoutContent', id, op: 'add', value } ] })
                }
            }

        } else {
            setLayoutContent(layoutContent => {
                if (value){
                    if (layoutContent.hasOwnProperty(id)){
                        layoutContent[id] = { ...layoutContent[id], ...value }
                    } else {
                        layoutContent[id] = value
                    }
                } else {
                    if (contentFormatting && contentFormatting.hasOwnProperty(layoutContent[id].name)){
                        var newContentFormatting = {...contentFormatting}
                        delete newContentFormatting[layoutContent[id].name]
                        setContentFormatting(newContentFormatting)
                    }

                    layoutContent = update(layoutContent, { $unset: [id] })
                }

                return { ...layoutContent }
            })
        }



        /*
        // If there is part of an experiment condition, set the layout content there.
        if (experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current),
                experimentStep = experimentRef.current.groups[groupIndex].steps[router.query.stepid]

            if (!value){
                // If this was added as a part of the experiment, remove all the
                var addEdits = experimentStep.filter(change => change.prop === 'layoutContent' && change.id === id && ['add', 'edit'].indexOf(change.op) !== -1)

                if (addEdits.length){
                    setExperiment(experiment => {
                        var updatedExperiment = experiment, indexOfAddEdit
                        addEdits.forEach(addEdit => {
                            indexOfAddEdit = updatedExperiment.groups[groupIndex].steps[router.query.stepid].indexOf(addEdit)
                            updatedExperiment = update(updatedExperiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$splice: [[indexOfAddEdit, 1]] } } } } })
                        })

                        return updatedExperiment
                    })

                } else {
                    // Else, remove it from the main step.
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'remove' }] } } } } })
                    })
                }

            } else {
                // If this is an edit.
                var editToDefault = layoutContent.hasOwnProperty(id),
                    indexOfChange = experimentStep.findIndex(change => change.prop === 'layoutContent' && change.id === id && change.op !== 'remove')

                if (indexOfChange !== -1){
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [indexOfChange]: { value: {$merge: value}, prop: {$set: 'layoutContent'} }} } } } })
                    })

                } else if (editToDefault) {
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'edit', value } ] } } } } })
                    })

                // If this is an add.
                } else {
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layoutContent', id, op: 'add', value } ] } } } } })
                    })
                }
            }
        */

    }

    var updateFormatting = (id, property, value) => {
        // If there is part of an experiment condition, set the changed formatting there.
        if (experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current),
                experimentStep = experimentRef.current.groups[groupIndex].steps[router.query.stepid]

            if (value === undefined){
                // If this was added as a part of the experiment, remove all the
                var changes = experimentStep.filter(change => change.prop === 'contentFormatting' && change.id === id && change.op === 'change' && change.value.property === property)

                if (changes.length){
                    setExperiment(experiment => {
                        var updatedExperiment = experiment, indexOfChange
                        changes.forEach(change => {
                            indexOfChange = updatedExperiment.groups[groupIndex].steps[router.query.stepid].indexOf(change)
                            updatedExperiment = update(updatedExperiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$splice: [[indexOfChange, 1]] } } } } })
                        })

                        return updatedExperiment
                    })

                } else {
                    // Else, remove it from the main step.
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'contentFormatting', id: id, op: 'remove', value: { property }  }] } } } } })
                    })
                }

            } else {
                var recentChangeToPropertyIndex = experiment.groups[groupIndex].steps[router.query.stepid].findIndex(
                        change => change.prop === 'contentFormatting' && change.id === id && change.value.property === property)

                if (recentChangeToPropertyIndex !== -1){
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [recentChangeToPropertyIndex]: { op: { $set: 'change' }, value: { $set: { property, value } } } } } } } })
                    })

                } else {
                    setExperiment(experiment => {
                        return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'contentFormatting', id: id, op: 'change', value: { property, value }  }] } } } } })
                    })
                }
            }

        } else {
            var newFormatting = { ...(contentFormatting || {}), [id] : {
                ...(contentFormatting && contentFormatting[id] ? contentFormatting[id] : {}),
            }}

            if (value !== undefined){
                newFormatting[id][property] = value
            } else if (newFormatting[id].hasOwnProperty(property)){
                delete newFormatting[id][property]

                if (!Object.keys(newFormatting[id]).length){
                    delete newFormatting[id]
                }
            }

            setContentFormatting(newFormatting)
        }
    }

    var updateLayout = (newLayout) => {
        if (experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current)

            var recentChangeToPropertyIndex = experimentRef.current.groups[groupIndex].steps[router.query.stepid].findIndex(
                    change => change.prop === 'layout')

            if (recentChangeToPropertyIndex !== -1){
                setExperiment(experiment => {
                    return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [recentChangeToPropertyIndex]: { value: { $set: JSON.stringify(newLayout) } } } } } } })
                })
            } else {
                setExperiment(experiment => {
                    return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'layout', value: JSON.stringify(newLayout) } ] } } } } })
                })
            }

        } else {
            if (JSON.stringify(newLayout) !== JSON.stringify(layout.body))
                setLayout({ body: newLayout, changed: true })
        }
    }

    var updateResponseCheck = (newResponseCheck) => {
        if (experimentRef.current && experimentRef.current.current !== 'All'){
            const groupIndex = experimentRef.current.groups.findIndex(group => group.name === experimentRef.current.current)

            var recentChangeToPropertyIndex = experimentRef.current.groups[groupIndex].steps[router.query.stepid].findIndex(
                    change => change.prop === 'responseCheck')

            if (recentChangeToPropertyIndex !== -1){
                setExperiment(experiment => {
                    return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: { [recentChangeToPropertyIndex]: { value: { $set: newResponseCheck } } } } } } })
                })
            } else {
                setExperiment(experiment => {
                    return update(experiment, { groups: { [groupIndex]: { steps: { [router.query.stepid]: {$push: [{ prop: 'responseCheck', value: newResponseCheck } ] } } } } })
                })
            }

        } else {
            setResponseCheck(newResponseCheck)
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

    return <div className='flex flex-col flex-auto'>
        {/*<a href={`/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`} target="_blank" rel="noreferrer">Preview</a>*/}

        <Head>
            <title>{step && step.name || 'Untitled step'}</title>
            <meta property="og:title" content={step && step.name || 'Untitled step'} key="title" />
        </Head>

        <ExperimentHeader experiment={experiment} />

        <EventsHeader events={events} />

        <WYSIWYGPanels context='step'
            layout={experimentAppliedLayout}
            onLayoutChange={(newLayout) => {
                updateLayout(newLayout)
            }}
            onDrop={(newLayout, layoutItem) => {
                var indexOfNewLayoutItem = newLayout.indexOf(layoutItem)
                newLayout[indexOfNewLayoutItem] = {
                    ...newLayout[indexOfNewLayoutItem], i: uuidv4().substring(0, 6)
                }
                delete newLayout[indexOfNewLayoutItem].isDraggable

                updateLayout(newLayout)
            }}
            onRemove={(id) => {
                updateLayout(
                    update(layout.body, { $splice: [[
                        layout.body.findIndex(box => box.i === id), 1
                    ]] })
                )
            }}

            layoutContent={experimentAppliedLayoutContent}
            updateLayoutContent={updateLayoutContent}

            formatting={experimentAppliedContentFormatting}
            updateFormatting={updateFormatting}

            contentTypes={StepContentTypes}
            editableProps={{
                contentSettings, setContentSettings,
                stepID: router.query.stepid, flowID: router.query.flowid,
                appID: router.query.appid, response: response && response[router.query.stepid]
            }}

            formattingPanelAdditions={(selectedContent, toggleSelectedContent) => {
                var contentType = selectedContent && StepContentTypes.find(contentType => {
                    return selectedContent.kind.startsWith(contentType.kind)
                }),
                    layoutIDs = Object.keys(experimentAppliedLayoutContent),
                    id = selectedContent && layoutIDs.find(
                        layoutID => experimentAppliedLayoutContent[layoutID].name === selectedContent.name),
                    selectedContentContent = id && experimentAppliedLayoutContent[id]

                return  [
                selectedContent || (experiment && experiment.groups) || events?.current ? null : <div><button key={0} onClick={() => {
                    // setExperiment(initialExperiment(router))

                    const url = new URL(window.location.href)
                    searchParams.set('group', 'A')
                    url.search = new URLSearchParams(searchParams)
                    router.replace(url.toString())

                }}
                    className="inline-flex items-center rounded border border-transparent bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"

                >Differentiate</button></div>,

                selectedContent && events?.current !== selectedContent.name ? <div><button key={1} onClick={() => {
                    const url = new URL(window.location.href)
                    if (searchParams.get('event:click') === selectedContent.name){
                        searchParams.delete('event:click')
                    } else {
                        searchParams.set('event:click', selectedContent.name)
                    }

                    url.search = new URLSearchParams(searchParams)
                    router.replace(url.toString())
                }}
                    className="inline-flex items-center rounded border border-transparent bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"

                >Click</button></div> : null,

                contentSettings.Response?.changeFormat ? <ResponseTemplateMaker key={2} id={contentSettings.Response.changeFormat}
                    body={experimentAppliedLayoutContent[contentSettings.Response.changeFormat].body}
                    updateBody={body => updateLayoutContent(contentSettings.Response.changeFormat, { body })}

                    // closeChangeResponseFormat={() => setResponseChangeFormatOpen(null)}
                    closeChangeResponseFormat={() => setContentSettings({ ...contentSettings, Response: { ...contentSettings.Response, changeFormat: null } })}
                    updateLayoutContent={updateLayoutContent}
                    toggleSelectedContent={toggleSelectedContent}
                /> : null,

                // contentSettings.Response?.templateItems?.length ? <ExpectedResponse key={3}
                //     responseTemplateItems={contentSettings.Response.templateItems}
                //     setResponseCheck={updateResponseCheck}
                //     responseCheck={experimentAppliedResponseCheck}
                // /> : null,


                selectedContent && selectedContentContent ? <div key={4}>
                    {contentType.properties ? <PropertyEditor selectedContent={selectedContent}
                        properties={contentType.properties}

                        value={selectedContentContent ? selectedContentContent.body?.properties : null}
                        setValue={(value) => {
                            updateLayoutContent(id, { body: { ...(selectedContentContent.body ? selectedContentContent.body : {}), properties: value } })
                        }}
                    /> : null}
                </div> : null,

                selectedContent && selectedContentContent ? <ShowConditionEditor key={5}
                    showCondition={selectedContentContent.body?.properties?.showCondition}
                    setShowCondition={value => updateLayoutContent(id, { body: { ...(selectedContentContent.body ? selectedContentContent.body : {}), properties: {
                        ...(selectedContentContent.body ? selectedContentContent.body : {}).properties, showCondition: value
                    } } })}
                /> : null
            ]}}

            lockedContent={experimentLocked}
            currentEvents={events?.current}
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


const ResponseTemplateMaker = ({ id, body, updateBody, closeChangeResponseFormat, updateLayoutContent, toggleSelectedContent }) => {
    return <div>
        make response template:
        <div>
            <button onClick={() => {
                updateBody([...(body || []), { kind: 'responsespace', id: 'item_' + uuidv4().substring(0, 7) }])
            }}>Add response space</button>
            <button onClick={() => {
                updateBody([...(body || []), { kind: 'text', id: 'item_' + uuidv4().substring(0, 7) }])
            }}>Add text</button>
        </div>
        <ResponseTemplate
            body={body}
            updateBody={updateBody}
            updateLayoutContent={updateLayoutContent}
            toggleSelectedContent={toggleSelectedContent}
        />
        <button onClick={() => {
            closeChangeResponseFormat()
        }}>Done</button>
    </div>
}


/*
const ExpectedResponse = ({ responseTemplateItems, setResponseCheck, responseCheck }) => {
    return <div>
        <h3 className="text-lg font-medium leading-10">Check response</h3>
        {responseTemplateItems.map((item, i) => <div key={i}>
            {item.id}: {item.kind}
        </div>)}
        <textarea onBlur={event => setResponseCheck(event.target.value)} defaultValue={responseCheck} />
    </div>
}
*/

const ShowConditionEditor = ({ showCondition, setShowCondition }) => {
    const inputRef = useRef()
    const throttleRef = useRef()

    return <div>
        <h3 className="text-md font-medium leading-10">Show / hide</h3>

        <div className="relative flex items-start">
          <div className="flex h-5 items-center">
            <input
              ref={inputRef}
              id="comments"
              aria-describedby="comments-description"
              name="comments"
              type="checkbox"
              disabled={true}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            </div>

            <div className="ml-3 text-sm">
              <label htmlFor="comments" className="text-gray-700">
                Show only when...
              </label>
              <p>
                  <textarea
                    onChange={e => {
                        if (e.target.value.length && !inputRef.current.checked){
                            inputRef.current.checked = true
                        } else if (!e.target.value.length && inputRef.current.checked){
                            inputRef.current.checked = false
                        }

                        throttleCall(throttleRef, setShowCondition, 3, e.target.value || null)
                    }}
                  />
              </p>
            </div>
        </div>
    </div>
}


export default Step
