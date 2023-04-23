import type { NextPage } from 'next'
import type { AppProps } from 'next/app'
import {useState, useEffect, useRef, useContext, forwardRef} from 'react'
import { collection, getDocs, setDoc, getDoc, doc, updateDoc,
    getCollection, arrayUnion, writeBatch, deleteDoc, serverTimestamp } from "firebase/firestore"
import { useRouter, router } from 'next/router'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'
import { useDrag, useDrop } from 'react-dnd'
import extend from 'deep-extend'
import update from 'immutability-helper'
import { Fragment } from 'react'
import { Menu, Transition, Dialog } from '@headlessui/react'
import Head from 'next/head'
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid'
import Layout, { TabbedPageLayout } from '../../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../../../_app'
import { classNames } from '../../../../../utils/common.tsx'
import { useFirestore } from 'reactfire'
import { UserContext } from '../../../../_app'
import Cookies from 'js-cookie'


let stepsChangeInterval

const Flow: NextPageWithLayout = ({}: AppProps) => {
    var [flow, setFlow] = useState()

    var [steps, setSteps] = useState()
    var stepsRef = useRef(), lastUpdatedStepsRef = useRef()

    var [duplicateStepToOpen, setDuplicateStepToOpen] = useState()

    const router = useRouter(),
        db = useFirestore()

    const [user, userID] = useContext(UserContext)

    useEffect(() => {
        if (router.query.flowid && userID){
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
                    setDoc(doc(db, "flows", newFlowID), {
                        name: 'Untitled flow', timestamp: serverTimestamp(),
                        users: [userID]
                    }).then(() => {
                        if (router.query.appid !== 'none'){
                            updateDoc(doc(db, "apps", router.query.appid), { flows: arrayUnion(newFlowID) }).then(() => {
                                router.replace(`/admin/app/${router.query.appid}/flow/${newFlowID}`)
                            })
                        } else {
                            var userRef = doc(db, "users", userID)
                            getDoc(userRef).then(docSnapshot => {
                                (docSnapshot.exists() ? updateDoc(
                                    userRef, { flows: arrayUnion(newFlowID) }): setDoc(
                                    userRef, { name: 'Someone something', flows: [newFlowID] })
                                ).then(() => {
                                    router.replace(`/admin/app/${router.query.appid}/flow/${newFlowID}`)
                                })
                            })
                        }
                    })
                }

            } else {
                getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                    var flowData = docSnapshot.data()

                    setFlow(flowData)
                    // nameRef.current.value = flowData.name || ''

                    getDocs(collection(db, "flows", router.query.flowid, 'steps')).then(docsSnapshot => {
                        var unsortedSteps = []
                        docsSnapshot.forEach(doc => unsortedSteps.push({ id: doc.id, ...doc.data() }))

                        setSteps(unsortedSteps.sort((a, b) => a.position - b.position))
                    })
                })
            }

        }

    }, [router.query.flowid, userID])

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

    return <>
        <Head>
            <title>{flow && flow.name}</title>
            <meta property="og:title" content={flow && flow.name} key="title" />
        </Head>
        {steps ? <ul role="list" className="space-y-3">{steps.map((step, i) => <DraggableStep
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
            />)}
            <li key='new' onClick={() => {
                    router.push(`/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/new`)
                }}
                className='relative rounded-md rounded-lg border-2 border-gray-300 p-4 text-center text-gray-400 hover:text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer'>
                + Add a step
            </li>
            </ul> : null}
        {duplicateStepToOpen ? <DuplicateStepTo db={db} stepID={duplicateStepToOpen} /> : null}
    </>
}


export function getTabs(page){
    const appid = router?.state.query.appid,
        flowid = router?.state.query.flowid

    var urlProps = { appid, flowid },
        subpagePathname = '/admin/app/[appid]/flow/[flowid]/[subpage]',
        baseURL = appid && flowid ? `/admin/app/${appid}/flow/${flowid}` : ''

    return [
      [{ name: 'Steps', href: baseURL, current: !page }],
      [{ name: 'Data', href: {
          pathname: subpagePathname, query: { ...urlProps, subpage: 'data' }
      }, current: page === 'data' },
      { name: 'Settings', href: {
          pathname: subpagePathname, query: { ...urlProps, subpage: 'settings' }
      }, current: page === 'settings' }]
    ]
}


Flow.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs(null)} compress={true}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
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

    return <li ref={ref} style={{ opacity }} data-handler-id={handlerId} className='relative rounded-md bg-indigo-600 text-white px-6 py-4 shadow'>
        <div className="absolute top-0 right-0 hidden pt-4 pr-4 sm:block">
          <Menu as="div" className="relative block">
            <Menu.Button className="rounded text-slate-400 hover:text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              <span className="sr-only">Open options</span>
              <EllipsisVerticalIcon className="h-6 w-6" aria-hidden="true" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 -mr-1 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  {[
                      {
                          href: {
                              pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
                              query: { appid: router.query.appid, flowid: router.query.flowid, stepid: 'new', duplicate: step.id }
                          },
                          name: 'Duplicate'
                      },
                      { onClick: () => setDuplicateStepToOpen(step.id), name: 'Duplicate to...'},
                      { onClick: () => {
                          if (window.confirm('Are you sure you want to delete ' + step.id + '?')){
                              deleteStep(step.id)
                          }
                      }, name: 'Delete...'}
                  ].map((item) => (
                    <Menu.Item key={item.name}>
                      {({ active }) => {
                          // console.log(item.name, active)
                          var props = {className: classNames('cursor-pointer',
                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                            'block px-4 py-2 text-sm'
                          )}
                          if (item.href){
                              return <MyLink {...props} href={item.href}>{item.name}</MyLink>
                          } else {
                              props.onClick = item.onClick
                              return <a {...props}>{item.name}</a>
                          }
                    }}
                    </Menu.Item>
                  ))}
                </div>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>

        <div>
            <Link href={{
                pathname: '/admin/app/[appid]/flow/[flowid]/step/[stepid]',
                query: { appid: router.query.appid, flowid: router.query.flowid, stepid: step.id }
            }}><a className="font-bold">{step.name ? `${step.name} [${step.id}]` : ('Untitled step' || step.id)}</a></Link>
        </div>
        <div>

        </div>
    </li>
}


// Copied from https://headlessui.com/react/menu.
var forwardedLink = (props, ref) => {
  let { href, children, ...rest } = props
  return (
    <Link href={href}>
      <a ref={ref} {...rest}>
        {children}
      </a>
    </Link>
  )
}
const MyLink = forwardRef(forwardedLink)


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


export default Flow
