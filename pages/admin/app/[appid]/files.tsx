import Layout, { TabbedPageLayout } from '../../../../components/admin-layout'
import type { NextPageWithLayout } from '../../_app'
import {useState, useEffect, useRef, useContext} from 'react'
import {getTabs} from '../[appid]'
import { useStorage } from 'reactfire'
import { v4 as uuidv4 } from 'uuid'
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage"
import { useRouter } from 'next/router'
import { classNames } from '../../../../utils/common'
import { PlusIcon } from '@heroicons/react/24/solid'
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid'
import { FolderIcon } from '@heroicons/react/24/outline'


const Files: NextPageWithLayout = ({}: AppProps) => {
    const [currentFolder, setCurrentFolder] = useState([])
    const [folders, setFolders] = useState([])
    const [files, setFiles] = useState([])
    const storage = useStorage()
    const router = useRouter()
    const [selectedFile, setSelectedFile] = useState()
    const uploadInputRef = useRef()

    var workingDirectory = `app/${router.query.appid}${currentFolder ? '/' : ''}${currentFolder.join('/')}`

    var getFilesAndFolders = () => {
        setFiles([])
        setFolders([])

        const listRef = ref(storage, workingDirectory)

        listAll(listRef)
          .then((res) => {
              res.items.forEach((itemRef) => {
                  getDownloadURL(itemRef).then((url) => {
                      setFiles(files => {
                          if (files.indexOf(url) === -1)
                            return files.concat([url])

                          return files
                      })
                  })
              })

              res.prefixes.forEach((folderRef) => {
                  setFolders(folders => {
                      if (folders.indexOf(folderRef.name) === -1)
                        return folders.concat([folderRef.name])

                      return folders
                  })
              })
        }).catch((error) => {
          // Uh-oh, an error occurred!
        });
    }

    var onUploadInputChange = event => {
        var fileFullname = event.target.files[0].name
        var [filename, extension] = fileFullname.split('.')

        const storageRef = ref(storage, `${workingDirectory}/${filename}-${uuidv4().substring(0, 3)}.${extension}`)

        uploadBytes(storageRef, event.target.files[0]).then((snapshot) => {
            getDownloadURL(storageRef).then(url => {
                setFiles(files => files.concat([url]))
            })
        })
    }

    useEffect(() => {
        if (router.query.appid){
            getFilesAndFolders()
        }
    }, [currentFolder, router.query.appid])

    return <div>
        <nav className="flex" aria-label="Breadcrumb">
          <ol role="list" className="flex items-center space-x-4">
            <li>
              <div>
                <a onClick={() => setCurrentFolder([])} className="cursor-pointer text-gray-400 hover:text-gray-500">
                  <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="sr-only">Home</span>
                </a>
              </div>
            </li>
            {currentFolder.map((folder) => (
              <li key={folder}>
                <div className="flex items-center">
                  <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                  <a
                    onClick={() => {
                        var indexOfFolder = currentFolder.indexOf(folder)
                        setCurrentFolder(currentFolder.splice(0, indexOfFolder + 1))
                    }}
                    className="cursor-pointer ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                    aria-current={folder === (currentFolder.length && currentFolder[currentFolder.length - 1]) ? 'page' : undefined}
                  >
                    {folder}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </nav>



        <ul role="list" className="grid grid-cols-4 gap-x-6 gap-y-8 sm:grid-cols-6 sm:gap-x-8 lg:grid-cols-10 xl:gap-x-10 px-4 sm:p-6">
          {folders.map((folder) => (
            <li key={folder} className="relative" onClick={() => {
                setCurrentFolder(currentFolder => currentFolder.concat([folder]))
            }}>
              <div className={classNames("group aspect-w-10 aspect-h-7 block w-full overflow-hidden rounded-lg bg-gray-100")}>
                <div className="pointer-events-none group-hover:opacity-75" ><FolderIcon className="h-full" /></div>
                <button type="button" className="absolute inset-0 focus:outline-none">
                  <span className="sr-only">View details for {folder}</span>
                </button>
              </div>
              <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">{folder}</p>
              {/*<p className="pointer-events-none block text-sm font-medium text-gray-500">{file.size}</p>*/}
            </li>
          ))}

          {files.map((file) => {
              var fileURL = new URL(decodeURIComponent(file))

              return (
            <li key={file} className="relative" onClick={() => {
                if (selectedFile !== file){
                    setSelectedFile(file)
                } else {
                    setSelectedFile()
                }
            }}>
              <div className={classNames("group aspect-w-10 aspect-h-7 block w-full overflow-hidden rounded-lg bg-gray-100", selectedFile === file ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-100' : '')}>
                 <div className="opacity-0 hover:opacity-100 absolute z-10">
                     <button
                       type="button"
                       className="mx-auto w-full justify-center rounded-md border border-transparent px-3 py-2 text-base font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto sm:text-xs bg-indigo-600 hover:bg-indigo-700"
                       onClick={e => {
                           navigator.clipboard.writeText(file)
                           alert('URL copied successfully')
                           e.stopPropagation()
                       }}
                     >
                       Copy URL
                     </button>

                 </div>
                {['jpg', 'png', 'jpeg', 'bmp', 'gif'].indexOf(fileURL.pathname.split('/').slice(-1)[0].split('.')[1].toLowerCase()) !== -1 ? <img src={file} alt="" className="pointer-events-none object-cover group-hover:opacity-75" /> : <div alt="" className="pointer-events-none object-cover group-hover:opacity-75" />}
                <button type="button" className="absolute inset-0 focus:outline-none">
                  <span className="sr-only">View details for {file}</span>
                </button>
              </div>
              <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">{fileURL.pathname.split('/').slice(-1)}</p>
              {/*<p className="pointer-events-none block text-sm font-medium text-gray-500">{file.size}</p>*/}
            </li>
          )})}
          <li key='upload' className="relative" onClick={() => {
              uploadInputRef.current.click()
          }}>
              <input ref={uploadInputRef} className="hidden" type="file" accept="*" onChange={onUploadInputChange} />
              <div className={classNames("group aspect-w-10 aspect-h-7 block w-full overflow-hidden rounded-lg bg-gray-100")}>
                <PlusIcon alt="" className="pointer-events-none object-cover group-hover:opacity-75" />
                <button type="button" className="absolute inset-0 focus:outline-none">
                  <span className="sr-only">Upload new...</span>
                </button>
              </div>
              <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">Upload new...</p>
          </li>
        </ul>
    </div>
}


Files.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout>
        <TabbedPageLayout tabs={getTabs('files')} compress={false}>
            {page}
        </TabbedPageLayout>
    </Layout>
  )
}


export default Files
