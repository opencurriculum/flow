import { Fragment, useState, useEffect, useRef, useContext } from 'react'
import { Disclosure, Menu, Transition, Dialog } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import Head from 'next/head'
import { ChevronRightIcon, HomeIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { classNames } from '../utils/common.tsx'
import { getDoc, doc, collection, getCollection, updateDoc } from "firebase/firestore"
import { useFirestore } from 'reactfire'
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid'
import { UserContext } from '../pages/_app'
import login, {logout} from '../components/login.tsx'
import { PencilIcon } from '@heroicons/react/20/solid'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'


export default function Layout({ children }) {
  return (
    <>
      <AdminAppHeader />
      <DndProvider backend={HTML5Backend}>
          {children}
      </DndProvider>
    </>
  )
}


export function TabbedPageLayout({ children, page, tabs, compress }) {
  return (
    <>
      <TabbedPageHeader page={page} tabs={tabs} compress={compress}>{children}</TabbedPageHeader>
    </>
  )
}


const userNavigation = [
    { name: 'Sign out', onClick: logout }
]


export const AdminAppHeader = () => {
    var [flow, setFlow] = useState()
    var [step, setStep] = useState()
    var [app, setApp] = useState()
    var [page, setPage] = useState()
    var [editNameOpen, setEditNameOpen] = useState(false)
    const [user, userID] = useContext(UserContext)

    const router = useRouter(),
        db = useFirestore()

    const breadcrumb = (router.query.appid === 'none' || !router.query.appid) ? [] : [
      { name: app && app.name || 'Untitled app', href: `/admin/app/${router.query.appid}`, current: router.route === '/admin/app/[appid]', kind: 'app' },
    ]

    var previewURL
    if (router.query.appid){
        previewURL = `/app/${router.query.appid}`
    }

    if (router.query.flowid){
        breadcrumb.push({ name: flow && flow.name || 'Untitled flow', href: `/admin/app/${router.query.appid}/flow/${router.query.flowid}`, current: router.route === '/admin/app/[appid]/flow/[flowid]', kind: 'flow' })
        previewURL = `/app/${router.query.appid}/flow/${router.query.flowid}`
    }

    if (router.query.stepid){
        breadcrumb.push({ name: step && step.name || 'Untitled step', href: `/admin/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`, current: router.route === '/admin/app/[appid]/flow/[flowid]/step/[stepid]', kind: 'step' })
        previewURL = `/app/${router.query.appid}/flow/${router.query.flowid}/step/${router.query.stepid}`
    }

    if (router.query.pageid){
        breadcrumb.push({ name: page && page.name || 'Untitled page', href: `/admin/app/${router.query.appid}/page/${router.query.pageid}`, current: router.route === '/admin/app/[appid]/page/[pageid]', kind: 'page' })
        previewURL = `/app/${router.query.appid}/page/${router.query.pageid}`
    }

    useEffect(() => {
        if (router.query.appid && router.query.appid !== 'none'){
            getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setApp(docSnapshot.data())
                }
            })
        }
    }, [router.query.appid])

    useEffect(() => {
        if (router.query.flowid){
            getDoc(doc(db, "flows", router.query.flowid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setFlow(docSnapshot.data())
                }
            })
        }
    }, [router.query.flowid])

    useEffect(() => {
        if (router.query.stepid){
            getDoc(doc(db, "flows", router.query.flowid, 'steps', router.query.stepid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setStep(docSnapshot.data())
                }
            })
        }
    }, [router.query.stepid])

    useEffect(() => {
        if (router.query.pageid){
            getDoc(doc(db, "apps", router.query.appid, 'pages', router.query.pageid)).then(docSnapshot => {
                if (docSnapshot.exists()){
                    setPage(docSnapshot.data())
                }
            })
        }
    }, [router.query.pageid])


    var name, currentKind
    if (router.query.stepid){
        name = step && step.name
        currentKind = 'step'
    } else if (router.query.flowid){
        name = flow && flow.name
        currentKind = 'flow'
    } else if (router.query.pageid){
        name = page && page.name
        currentKind = 'page'
    }

    return <>
        <Disclosure as="nav" className="bg-gray-800">
          {({ open }) => (
            <>
              <div className="mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex h-12 items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <img
                        className="h-8 w-8"
                        src="/flow.svg"
                        alt="OpenCurriculum Flow"
                      />
                    </div>
                    <div className="hidden md:block">
                      <div className="ml-10 flex items-baseline space-x-4">

                          <nav className="flex" aria-label="Breadcrumb">
                            <ol role="list" className="flex items-center space-x-4">
                              <li>
                                <div>
                                  <Link href="/admin"><a className="text-gray-300 hover:text-gray-100">
                                    <HomeIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                                    <span className="sr-only">Home</span>
                                  </a></Link>
                                </div>
                              </li>
                              {breadcrumb.map((page) => (
                                <li key={page.name}>
                                  <div className="flex items-center">
                                    <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-gray-500" aria-hidden="true" />

                                    <div className="flex items-center text-sm">
                                        <Link href={page.href}><a
                                          className="ml-4 text-sm font-medium text-gray-300 hover:text-gray-100"
                                          aria-current={page.current ? 'page' : undefined}
                                        >
                                          {page.name}
                                        </a></Link>
                                        {page.current && (page.kind !== 'app') ? <button
                                          type="button"
                                          onClick={e => setEditNameOpen(true)}
                                          className="rounded-full ml-2 flex-shrink-0 p-2 text-gray-400 hover:bg-gray-700 hover:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                                        >
                                          <PencilIcon className="h-4 w-4" aria-hidden="true" />
                                          <span className="sr-only">Edit name</span>
                                        </button> : null}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ol>
                          </nav>

                      </div>
                    </div>
                  </div>
                  <div className="hidden md:block">
                    <div className="ml-4 flex items-center md:ml-6">

                        {/* Preview button */}
                        <div className="p-1 inline-flex rounded-md shadow-sm">
                          {previewURL ? <a
                            href={previewURL} target="_blank" rel="noreferrer"
                            className={classNames(router.query.group ? 'border-r-indigo-500' : 'rounded-r-md', "rounded-l-md relative inline-flex items-center border border-transparent bg-indigo-600 px-4 py-0.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500")}
                          >
                            Preview
                          </a> : null}
                          {router.query.group ? <Menu as="div" className="relative block">
                            <Menu.Button className="h-full relative inline-flex items-center rounded-r-md border border-transparent bg-indigo-600 px-2 py-0.5 text-sm font-medium text-slate-400 hover:bg-indigo-700 focus:z-10 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                              <span className="sr-only">Open options</span>
                              <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
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
                                      { name: 'Preview as "Group A"', href: previewURL + '?group=A' },
                                      { name: 'Preview as "Group B"', href: previewURL + '?group=B' },
                                  ].map((item) => (
                                    <Menu.Item key={item.name}>
                                      {({ active }) => (
                                        <a
                                          href={item.href}
                                          target="_blank" rel="noreferrer"
                                          className={classNames(
                                            active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                                            'block px-4 py-2 text-sm'
                                          )}
                                        >
                                          {item.name}
                                        </a>
                                      )}
                                    </Menu.Item>
                                  ))}
                                </div>
                              </Menu.Items>
                            </Transition>
                          </Menu> : null}
                        </div>
                        {/* End of preview button */}

                      {/* Profile dropdown */}
                      {user && !user.isAnonymous ? <Menu as="div" className="relative ml-3">
                        <div>
                          <Menu.Button className="flex max-w-xs items-center rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                            <span className="sr-only">Open user menu</span>
                            <img className="h-8 w-8 rounded-full" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                          </Menu.Button>
                        </div>
                        <Transition
                          as={Fragment}
                          enter="transition ease-out duration-100"
                          enterFrom="transform opacity-0 scale-95"
                          enterTo="transform opacity-100 scale-100"
                          leave="transition ease-in duration-75"
                          leaveFrom="transform opacity-100 scale-100"
                          leaveTo="transform opacity-0 scale-95"
                        >
                          <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            {userNavigation.map((item) => (
                              <Menu.Item key={item.name}>
                                {({ active }) => {
                                    let itemClassNames = [
                                        active ? 'bg-gray-100' : '',
                                        'block px-4 py-2 text-sm text-gray-700'
                                    ]

                                    if (item.onClick){
                                        itemClassNames.push('cursor-pointer')
                                        return <a onClick={item.onClick} className={classNames(...itemClassNames)}>{item.name}</a>
                                    }
                                    return <Link href={item.href}><a
                                        className={classNames(...itemClassNames)}
                                      >
                                        {item.name}
                                    </a></Link>
                                }}
                              </Menu.Item>
                            ))}
                          </Menu.Items>
                        </Transition>
                      </Menu> : (user === undefined ? null : <a
                        onClick={login}
                        className={classNames("cursor-pointer rounded-r-md rounded-l-md relative inline-flex items-center border border-transparent bg-cyan-600 px-4 py-0.5 text-sm font-medium text-white shadow-sm hover:bg-cyan-700 focus:z-10 focus:outline-none focus:ring-1 focus:ring-cyan-500")}
                      >
                        Login and save progress
                      </a>)}
                    </div>
                  </div>
                  <div className="-mr-2 flex md:hidden">
                    {/* Mobile menu button */}
                    <Disclosure.Button className="inline-flex items-center justify-center rounded-md bg-gray-800 p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                      <span className="sr-only">Open main menu</span>
                      {open ? (
                        <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                      ) : (
                        <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                      )}
                    </Disclosure.Button>
                  </div>
                </div>
              </div>

              {/* Profile menu */}
              {user && !user.isAnonymous ? <Disclosure.Panel className="md:hidden">
                <div className="space-y-1 px-2 pt-2 pb-3 sm:px-3">
                </div>
                <div className="border-t border-gray-700 pt-4 pb-3">
                  <div className="flex items-center px-5">
                    <div className="flex-shrink-0">
                      <img className="h-10 w-10 rounded-full" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium leading-none text-white">{user.name}</div>
                      <div className="text-sm font-medium leading-none text-gray-400">{user.email}</div>
                    </div>

                  </div>
                  <div className="mt-3 space-y-1 px-2">
                    {userNavigation.map((item) => (
                      <Disclosure.Button
                        key={item.name}
                        as="a"
                        href={item.href}
                        className="block rounded-md px-3 py-2 text-base font-medium text-gray-400 hover:bg-gray-700 hover:text-white"
                      >
                        {item.name}
                      </Disclosure.Button>
                    ))}
                  </div>
                </div>
              </Disclosure.Panel> : null}
            </>
          )}
        </Disclosure>

        <EditNameModal
            name={name}
            kind={currentKind}
            open={editNameOpen}
            setOpen={setEditNameOpen}
            update={(name) => {
                if (router.query.stepid){
                    updateDoc(doc(db, "flows", router.query.flowid, "steps", router.query.stepid), { name })
                    setStep({ ...step, name })
                } else if (router.query.flowid){
                    updateDoc(doc(db, "flows", router.query.flowid), { name })
                    setFlow({ ...flow, name })
                } else if (router.query.pageid){
                    updateDoc(doc(db, "apps", router.query.appid, "pages", router.query.pageid), { name })
                    setPage({ ...page, name })
                }
            }}
        />
    </>
}

export const EditNameModal = ({ name, kind, open, setOpen, update }) => {
    const cancelButtonRef = useRef(null)
    var nameRef = useRef()

    useEffect(() => {
        if (nameRef.current){
            nameRef.current.value = name || ''
        }
    }, [name])

    return <Transition.Root show={open} as={Fragment}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div>
                      <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                        Edit name
                      </Dialog.Title>

                      <div className='mt-2'>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                          Name
                        </label>
                        <div className="mt-1">
                          <input
                            defaultValue={name}
                            ref={nameRef}
                            type="text"
                            name="name"
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md
                            text-slate-900"
                            placeholder={kind ? `${kind.substring(0, 1).toUpperCase()}${kind.substring(1)} name` : null}
                          />
                        </div>
                      </div>

                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => {
                        update(nameRef.current.value)
                        setOpen(false)
                    }}
                  >
                    Done
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>

}

function Tab({ tab }){
    return <Link
      href={tab.href}
    >
      <a
      className={classNames(
        tab.current
          ? 'border-indigo-500 text-indigo-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
        'whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm'
      )}
      aria-current={tab.current ? 'page' : undefined}

      >{tab.name}</a>
    </Link>
}


export const TabbedPageHeader = ({ children, page, tabs, compress }) => {
    var nameRef = useRef()

    var [editNameOpen, setEditNameOpen] = useState(false)
    const cancelButtonRef = useRef(null)

    const router = useRouter(),
        db = useFirestore()

    return <div className='h-full bg-gray-100 flex-auto'>
        <div className="min-h-full">
            {tabs && tabs.length ? <header className="bg-white shadow">
              <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  <div>
                    <div className="sm:hidden">
                      <label htmlFor="tabs" className="sr-only">
                        Select a tab
                      </label>
                      {/* Use an "onChange" listener to redirect the user to the selected tab URL. */}
                      <select
                        id="tabs"
                        name="tabs"
                        className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                        defaultValue={tabs.flat().find((tab) => tab.current).name}
                      >
                        {tabs.flat().map((tab) => (
                          <option key={tab.name}>{tab.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="hidden sm:block">
                      <div>
                        <nav className="-mb-px h-12 flex items-center justify-between" aria-label="Tabs">
                              <div className="hidden md:block space-x-8">
                                  {tabs[0].map((tab) => <Tab tab={tab} key={tab.name} />)}
                              </div>
                              <div className="hidden md:block space-x-8">
                                  {tabs[1].map((tab) => <Tab tab={tab} key={tab.name} />)}
                            </div>
                        </nav>
                      </div>
                    </div>
                  </div>
              </div>
            </header> : null}

            <main>
              <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
                <div className={classNames(compress ? 'max-w-md' : '', 'mx-auto')}>
                    {children}
                </div>
              </div>
            </main>
        </div>


        <Transition.Root show={editNameOpen} as={Fragment}>
          <Dialog as="div" className="relative z-10" initialFocus={cancelButtonRef} onClose={setEditNameOpen}>
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
                  <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="sm:flex sm:items-start">
                          <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                            Deactivate account
                          </Dialog.Title>

                          <div className="mt-2">
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
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                      <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={() => setEditNameOpen(false)}
                      >
                        Deactivate
                      </button>
                      <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={() => setEditNameOpen(false)}
                        ref={cancelButtonRef}
                      >
                        Cancel
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition.Root>
    </div>
}
