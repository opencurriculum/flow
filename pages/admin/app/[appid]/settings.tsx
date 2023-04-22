import Layout, { TabbedPageLayout } from '../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import { getDoc, doc, updateDoc, deleteField, arrayUnion } from "firebase/firestore"
import { useRouter } from 'next/router'
import { useFirestore } from 'reactfire'
import Link from 'next/link'
import {getTabs} from '../[appid]'
import { UserContext } from '../../../_app'
import { PhotoIcon } from '@heroicons/react/24/outline'
import { useStorage } from 'reactfire'
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { TrashIcon } from '@heroicons/react/20/solid'
import { v4 as uuidv4 } from 'uuid'
import { throttleCall } from '../../../../utils/common'


const Settings: NextPageWithLayout = ({}: AppProps) => {
    var [app, setApp] = useState()
    const [user, userID] = useContext(UserContext)
    const storage = useStorage()

    const nameRef = useRef(),
        allowStepsListingRef = useRef(),
        stepsAliasRef = useRef(),
        uploadInputRef = useRef(),
        requireLoginRef = useRef(),
        homepageRef = useRef(),
        fullstoryOrgIDRef = useRef()

    const router = useRouter(),
        db = useFirestore()

    useEffect(() => {
        if (router.query.appid){
            getDoc(doc(db, "apps", router.query.appid)).then(docSnapshot => {
                var appData = docSnapshot.data()

                setApp(appData)
                nameRef.current.value = appData.name || ''
                allowStepsListingRef.current.checked = appData.allowStepsListing || false
                requireLoginRef.current.checked = appData.requireLogin || false
                stepsAliasRef.current.value = appData.stepsAlias || ''
                homepageRef.current.value = appData.homepage || ''
                fullstoryOrgIDRef.current.value = appData.fullstoryOrgID || ''
            })

        }
    }, [router.query.appid, db])

    const appDocRef = db && router.query.appid && doc(db, "apps", router.query.appid)

    return <>
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
              placeholder="App name"
              onBlur={(event) => updateDoc(appDocRef, { name: event.target.value })}
            />
          </div>

          <div className="relative flex items-start mt-4">
            <div className="flex h-5 items-center">
              <input
                ref={allowStepsListingRef}
                aria-describedby="allowStepsListing-description"
                name="allowStepsListing"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                onChange={(event) => updateDoc(appDocRef, { allowStepsListing: event.target.checked })}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="comments" className="font-medium text-gray-700">
                Allow students to see prior steps in a flow
              </label>
              <p id="comments-description" className="text-gray-500">
                This will allow them to review and jump to a step they have already responded to.
              </p>
            </div>
          </div>

          <div className="mt-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                What do you call steps in your app?
              </label>
              <div className="mt-1">
                <input
                  ref={stepsAliasRef}
                  type="text"
                  name="name"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="E.g., problems, items, questions"
                  onBlur={(event) => {
                      if (event.target.value.length)
                        updateDoc(appDocRef, { stepsAlias: event.target.value })
                  }}
                />
              </div>
          </div>

          <div className="mt-4">
              <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
                Logo
              </label>
              <div className="mt-1">
                  {app?.logo ? <div className="relative">
                      <div className="m-2 right-0 absolute bg-slate-900 hover:bg-slate-600 h-6 w-6 text-white"
                          onClick={() => {
                              // Delete the file.
                              var pathname = new URL(app.logo).pathname,
                                  indexOfStart = pathname.indexOf('/o/') + 3

                              const storageRef = ref(storage, decodeURIComponent(pathname.substring(indexOfStart)))

                              deleteObject(storageRef).then(() => {
                                  updateDoc(appDocRef, { logo: deleteField() })

                                  setApp(app => {
                                      delete app.logo
                                      return { ...app }
                                  })
                              }).catch((error) => {
                                  alert('Failed to delete the image.')
                              });

                          }}
                      >
                        <TrashIcon />
                      </div>
                      <img src={app.logo} />
                  </div> : <button
                    type="button"
                    className="mt-2 relative block w-full rounded-lg border-2 border-dashed border-gray-300 p-3 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    onClick={() => {
                        uploadInputRef.current.click()
                    }}
                  >
                      <input ref={uploadInputRef} className="hidden" type="file" accept="image/*" onChange={event => {
                          var fileFullname = event.target.files[0].name
                          var [filename, extension] = fileFullname.split('.')

                          const storageRef = ref(storage, `app/${router.query.appid}/${filename}-${uuidv4().substring(0, 3)}.${extension}`)

                          uploadBytes(storageRef, event.target.files[0]).then((snapshot) => {
                              getDownloadURL(storageRef).then(url => {
                                  updateDoc(appDocRef, { logo: url })

                                  setApp(app => {
                                      return { ...app, logo: url }
                                  })
                              })
                          })
                      }} />
                    <PhotoIcon className="mx-auto h-6 w-6 text-gray-400" stroke="currentColor" />
                    <span className="mt-2 block text-sm font-semibold text-gray-500">Upload new logo</span>

                  </button>}
                  </div>

              </div>


              <div className="mt-4">
                  <label htmlFor="logo" className="block text-sm font-medium text-gray-700">
                    Header links
                  </label>

                  <div className="mt-1 divide-y divide-gray-100">
                      {app?.headerLinks?.map((headerLink, i) => <HeaderLink
                          key={headerLink.id}
                          link={headerLink}
                          remove={() => {
                              setApp(app => {
                                  var newApp = { ...app },
                                    newLinks = [...newApp.headerLinks],
                                    indexOfLink = newLinks.findIndex(link => link.id === headerLink.id)

                                  newLinks.splice(indexOfLink, 1)

                                  if (!newLinks.length){
                                    updateDoc(appDocRef, { headerLinks: deleteField() })
                                  } else {
                                    updateDoc(appDocRef, { headerLinks: newLinks })
                                  }

                                  newApp.headerLinks = newLinks
                                  return newApp
                              })
                          }}
                          update={(newLink) => {
                              setApp(app => {
                                  var newApp = { ...app },
                                    newLinks = [...newApp.headerLinks],
                                    indexOfLink = newLinks.findIndex(link => link.id === headerLink.id)
                                  newLinks[indexOfLink] = newLink

                                  updateDoc(appDocRef, { headerLinks: newLinks })

                                  newApp.headerLinks = newLinks
                                  return newApp
                              })
                          }}
                      />)}
                      <button
                        type="button" onClick={() => {
                            setApp(app => {
                                var newApp = { ...app },
                                    newLinks = [...(newApp.headerLinks || [])],
                                    newLink = { title: '', url: '', id: uuidv4().substring(0, 3) }

                                newLinks.push(newLink)

                                updateDoc(appDocRef, { headerLinks: arrayUnion(newLink) })

                                newApp.headerLinks = newLinks
                                return newApp
                            })
                        }}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Add link
                      </button>
                  </div>
              </div>

              <div className="relative flex items-start mt-4">
                <div className="flex h-5 items-center">
                  <input
                    ref={requireLoginRef}
                    aria-describedby="requireLogin-description"
                    name="requireLogin"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={(event) => updateDoc(doc(db, "apps", router.query.appid), { requireLogin: event.target.checked })}
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="comments" className="font-medium text-gray-700">
                    Require students to log in
                  </label>
                  <p id="comments-description" className="text-gray-500">
                    If a student visits anything other than a page, the app will redirect her/him to a login page.
                    Once she/he has logged in, the app will redirect to the page he/she initially opened.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Home page URL
                  </label>
                  <div className="mt-1">
                    <input
                      ref={homepageRef}
                      type="text"
                      name="homepage"
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Leave blank to show page listing all flows"
                      onBlur={(event) => {
                          if (event.target.value.length)
                            updateDoc(appDocRef, { homepage: event.target.value })
                      }}
                    />
                  </div>
              </div>

              <div className="mt-4">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Fullstory organization ID
                  </label>
                  <div className="mt-1">
                    <input
                      ref={fullstoryOrgIDRef}
                      type="text"
                      name="homepage"
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Leave blank if you don't have a Fullstory account"
                      onBlur={(event) => {
                          if (event.target.value.length)
                            updateDoc(appDocRef, { fullstoryOrgID: event.target.value })
                      }}
                    />
                  </div>
              </div>

        </div>

    </>
}


function HeaderLink({ link, remove, update }){
    const indexRef = useRef()
    const titleRef = useRef()
    const urlRef = useRef()
    const throttleRef = useRef(uuidv4())

    useEffect(() => {
        if ([titleRef.current, urlRef.current].indexOf(document.activeElement) === -1){
            if (titleRef.current !== link.title){
                titleRef.current.value = link.title || ''
            }

            if (urlRef.current !== link.url){
                urlRef.current.value = link.url || ''
            }
        }
    }, [link])

    var updateProperty = (name, value) => {
        update({
            id: link.id,
            title: titleRef.current.value,
            url: urlRef.current.value
        })
    }

    var onChange = event => {
        throttleCall(
            throttleRef, updateProperty, 1.5, event.target.name, event.target.value || null)
    }

    return <div className="mb-3 flex">
        <div className="flex-1">
            <input
              ref={titleRef}
              aria-describedby="headerlink-title"
              name="title"
              type="text"
              placeholder="Title"
              className="mb-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              onChange={onChange}
            />
            <input
              ref={urlRef}
              aria-describedby="headerlink-title"
              name="url"
              type="text"
              placeholder="URL"
              className="mb-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              onChange={onChange}
            />
        </div>
        <div className="p-2">
            <button
              type="button"
              className="inline-flex rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              onClick={remove}
            >
              <span className="sr-only">Delete</span>
              <TrashIcon className="h-5 w-5" aria-hidden="true" />
            </button>
        </div>
    </div>
}


Settings.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('settings')} compress={true}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Settings
