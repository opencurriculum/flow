import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc,
    getCollection, arrayUnion, writeBatch, deleteDoc } from "firebase/firestore"
import { useRouter } from 'next/router'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import extend from 'deep-extend'
import update from 'immutability-helper'


const FlowWrapper: NextPage = ({ app, userID }: AppProps) => {
    const router = useRouter()

    if (!router.query.flowid)
        return null

    return <div>
        <Flow db={app.db} userID={userID} />
    </div>
}


let stepsChangeInterval

const Flow: NextPage = ({ db, userID }: AppProps) => {
    var [flow, setFlow] = useState()
    var nameRef = useRef()

    var [steps, setSteps] = useState()
    var stepsRef = useRef(), lastUpdatedStepsRef = useRef()

    var [duplicateStepToOpen, setDuplicateStepToOpen] = useState()

    const router = useRouter()

    useEffect(() => {
        if (router.query.flowid === 'new'){
            // Create a new flow.
            var newFlowID = uuidv4().substring(0, 8)

            // If there is a duplicate param, use that to make this new step.
            if (router.query.duplicate){
                getDoc(doc(db, "flows", router.query.duplicate)).then(docSnapshot => {
                    getDocs(collection(db, "flows", router.query.duplicate, 'steps')).then(docsSnapshot => {
                        var flowSteps = []
                        docsSnapshot.forEach(doc => flowSteps.push(doc.data()))

                        const batch = writeBatch(db)
                        setDoc(doc(db, "flows", newFlowID), { name: `Copy of ${docSnapshot.data().name}` })
                        updateDoc(doc(db, "apps", router.query.appid), { flows: arrayUnion(newFlowID) })

                        flowSteps.forEach(step => {
                            setDoc(doc(db, "flows", newFlowID, 'steps', uuidv4().substring(0, 8)), { ...step })
                        })

                        batch.commit().then(() => {
                            router.replace(`/admin/app/${router.query.appid}/flow/${newFlowID}`)
                        })
                    })
                })

            } else {
                setDoc(doc(db, "flows", newFlowID), { name: 'Untitled flow' }).then(() => {
                    updateDoc(doc(db, "apps", router.query.appid), { flows: arrayUnion(newFlowID) }).then(() => {
                        router.replace(`/admin/app/${router.query.appid}/flow/${newFlowID}`)
                    })
                })
            }

        } else {
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                var flowData = docSnapshot.data()

                setFlow(flowData)
                nameRef.current.value = flowData.name || ''

                getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                    var unsortedSteps = []
                    docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))

                    setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
                })
            })
        }
    }, [router.query.flowid])

    useEffect(() => {
        if (stepsRef.current && steps !== stepsRef.current){
            clearTimeout(stepsChangeInterval)
            stepsChangeInterval = setTimeout(() => {
                // Find all changed steps.
                var changedStepPositions = {}
                steps.forEach(step => {
                    lastUpdatedStepsRef.current.forEach(oldStep => {
                        if (step.id === oldStep.id && step.position !== oldStep.position){
                            changedStepPositions[step.id] = step.position
                        }
                    })
                })

                const batch = writeBatch(db)
                for (var stepID in changedStepPositions){
                    updateDoc(doc(db, "flows", router.query.flowid, 'steps', stepID), { position: changedStepPositions[stepID] })
                }
                batch.commit()

                lastUpdatedStepsRef.current = steps
                clearTimeout(stepsChangeInterval)
            }, 2000)

            stepsRef.current = steps

        } else if (steps && !stepsRef.current){
            lastUpdatedStepsRef.current = stepsRef.current = steps
        }
    }, [steps])

    return <div>
        <a href={`/app/${router.query.appid}/flow/${router.query.flowid}`} target="_blank" rel="noreferrer">Preview</a>

        <button onClick={() => {
            router.push(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/new`)
        }}>Add a step</button>
        Steps
        {steps ? <DndProvider backend={HTML5Backend}>
            <ul>{steps.map((step, i) => <DraggableStep
                key={i}
                step={step}
                moveStep={(fromPosition, toPosition) => {
                    setSteps(steps => {
                        let newSteps = [...steps],
                            indexOfThingBeingMoved = newSteps.findIndex(s => s.position === fromPosition)

                        var stepsToMove
                        if (fromPosition > toPosition){
                            stepsToMove = newSteps.splice(toPosition, fromPosition - toPosition)
                        } else {
                            stepsToMove = newSteps.splice(fromPosition + 1, toPosition - fromPosition)
                        }

                        newSteps[indexOfThingBeingMoved] = { ...newSteps[indexOfThingBeingMoved], position: toPosition }
                        newSteps = newSteps.concat(stepsToMove.map(s => ({
                            ...s, position: s.position + (fromPosition > toPosition ? 1 : -1)
                        })))

                        return newSteps.sort((a, b) => a.position - b.position)
                    })
                }}
                setDuplicateStepToOpen={setDuplicateStepToOpen}
                deleteStep={stepID => {
                    var indexOfStepToBeDeleted = steps.findIndex(s => s.id === stepID),
                        stepToBeDeleted = steps[indexOfStepToBeDeleted],
                        stepIDsAfterOneToBeDeleted = steps.filter(s => s.position > stepToBeDeleted.position).map(s => s.id)

                    setSteps(steps => update(steps, {
                        $splice: [[indexOfStepToBeDeleted, 1]],
                        $apply: ss => {
                            var updatedSteps = []
                            ss.forEach(s => {
                                if (stepIDsAfterOneToBeDeleted.indexOf(s.id) !== -1){
                                    updatedSteps.push({ ...s, position: s.position - 1 })
                                } else {
                                    updatedSteps.push(s)
                                }
                            })
                            return updatedSteps
                        }
                    }))

                    deleteDoc(doc(db, "flows", router.query.flowid, "steps", stepID))
                }}
            />)}</ul>
        </DndProvider> : null}

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
              onBlur={(event) => updateDoc(doc(db, "flows", router.query.flowid), { name: event.target.value })}
            />
          </div>
        </div>

        {duplicateStepToOpen ? <DuplicateStepTo db={db} stepID={duplicateStepToOpen} /> : null}
    </div>
}


const DraggableStep = ({ step, moveStep, setDuplicateStepToOpen, deleteStep }) => {
    const router = useRouter()
    const ref = useRef(null)

    const [{ handlerId }, drop] = useDrop({
      accept: 'step',
      collect(monitor) {
        return {
          handlerId: monitor.getHandlerId(),
        }
      },
      hover(item, monitor) {
        if (!ref.current) {
          return
        }
        const dragIndex = item.position
        const hoverIndex = step.position

        // Don't replace items with themselves
        if (dragIndex === hoverIndex) {
          return
        }

        // Determine rectangle on screen
        const hoverBoundingRect = ref.current?.getBoundingClientRect()
        // Get vertical middle
        const hoverMiddleY =
          (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
        // Determine mouse position
        const clientOffset = monitor.getClientOffset()
        // Get pixels to the top
        const hoverClientY = clientOffset.y - hoverBoundingRect.top
        // Only perform the move when the mouse has crossed half of the items height
        // When dragging downwards, only move when the cursor is below 50%
        // When dragging upwards, only move when the cursor is above 50%
        // Dragging downwards
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return
        }
        // Dragging upwards
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
          return
        }
        // Time to actually perform the action
        moveStep(dragIndex, hoverIndex)
        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        item.position = hoverIndex
      },
    })

    const [{opacity}, drag] = useDrag(() => ({
        type: 'step',
        item: { id: step.id, position: step.position },
        collect: (monitor) => ({
            opacity: monitor.isDragging() ? 0.5 : 1
        }),
    }), [])

    drag(drop(ref))

    return <li ref={ref} style={{ opacity }} data-handler-id={handlerId}>
        <Link href={{
            pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
            query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id }
        }}><a className="font-bold">{step.name ? `${step.name} [${step.id}]` : step.id}</a></Link>
        <Link href={{
            pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
            query: { appid: router.query.appid, flowid: router.query.flowid, stepid: 'new', duplicate: step.id }
        }}><a>(Duplicate)</a></Link>
        <a onClick={() => setDuplicateStepToOpen(step.id)}>(Duplicate to...)</a>
        <a onClick={() => {
            if (window.confirm('Are you sure you want to delete ' + step.id + '?')){
                deleteStep(step.id)
            }
        }}>Delete...</a>
    </li>
}

const DuplicateStepTo = ({ db, stepID }) => {
    var [flows, setFlows] = useState()
    const router = useRouter()

    useEffect(() => {
        getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
            var appFlows = docSnapshot.data().flows
            setFlows(update(appFlows, { $splice: [[appFlows.indexOf(router.query.flowid), 1]] }))
        })
    }, [router.query.appid])

    return <div>
        Pick a flow

        <select onChange={(e) => {
            router.push({
                pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
                query: { appid: router.query.appid, flowid: e.target.value, stepid: 'new', duplicate: stepID, fromFlow: router.query.flowid }
            })
        }}>
            <option></option>
            {flows && flows.map((flow, i) => <option key={i} value={flow}>
                {flow}
            </option>)}
        </select>
    </div>
}


export default FlowWrapper
