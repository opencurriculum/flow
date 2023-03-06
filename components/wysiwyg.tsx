import { useState, useEffect, useRef } from 'react'
import GridLayout from "react-grid-layout"
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import styles from '../styles/components/StepAdmin.module.sass'
import {Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import {blockStyleFn, classNames} from '../utils/common'
import { Switch } from '@headlessui/react'


const WYSIWYGPanelsDraggable: NextPageWithLayout = (props) => {
    return <DndProvider backend={HTML5Backend}>
        <WYSIWYGPanels {...props} />
    </DndProvider>;
}

function getContentType(content, contentTypes){
    return content && contentTypes.find(contentType => {
        return content.kind === contentType.kind || content.name.startsWith(contentType.kind)
    })
}


const WYSIWYGPanels = ({ context, layout, onRemove, onLayoutChange, onDrop, layoutContent,
    updateLayoutContent, formatting, updateFormatting, contentTypes, editableProps,
    formattingPanelAdditions, lockedContent, currentEvents }) => {
    const [isContentBeingDragged, setIsContentBeingDragged] = useState(false)
    const [selectedContent, setSelectedContent] = useState()
    const currentEventsRef = useRef()

    useEffect(() => {
        if (currentEventsRef.current && !currentEvents && selectedContent){
            setSelectedContent()
        }

        currentEventsRef.current = currentEvents
    }, [currentEvents])

    var onDragContentBegin = () => {
        setIsContentBeingDragged(true)
    }

    var onDragContentEnd = () => {
        setIsContentBeingDragged(false)
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

    var showContentLabels = editableProps?.contentSettings?.all?.showContentLabels

    return <div className='flex flex-auto'>
        <div className='flex-none w-64 bg-gray-800 p-6 text-white'>
            {/*<button className='p-2' onClick={() => setLayout(initialLayout)}>Reset layout</button>*/}

            <div className='mb-4'>
                <h3 className="text-lg font-medium leading-10">Layout</h3>

                <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    <div
                      className="droppable-element cursor-pointer col-span-1 opacity-70 hover:opacity-100"
                      draggable={true}
                      unselectable="on"
                      // this is a hack for firefox
                      // Firefox requires some kind of initialization
                      // which we can do by adding this attribute
                      // @see https://bugzilla.mozilla.org/show_bug.cgi?id=568313
                      onDragStart={e => e.dataTransfer.setData("text/plain", "")}
                    >
                        <div className='border border-white h-12 w-full opacity-70'></div>
                        <div className='text-sm leading-8'>
                            Box
                        </div>
                    </div>
                </div>
            </div>

            <div className='mb-4'>
                <h3 className="text-lg font-medium leading-10">Blocks</h3>
                <ul role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    {(context === 'step' ? contentTypes.map(ct => ({ name: ct.kind })) : [{ name: 'Text' }]).map(item => <li key={item.name} className='cursor-pointer opacity-70 hover:opacity-100'>
                        <DraggableContent name={item.name} onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} />
                    </li>)}
                </ul>
            </div>
        </div>

        <div className='flex-auto relative overflow-auto bg-gray-100' >
            {layout && layoutContent ? <div className={styles.GridLayoutWrapper + ' mx-auto shadow-md'} style={{
                width: '1200px',
                //minHeight: 'calc(100vh - 3rem - 20px)',
                backgroundColor: '#fcfcfc'
            }} onClick={() => setSelectedContent() }>
                <GridLayout
                  className="layout"
                  layout={layout}
                  onLayoutChange={onLayoutChange}
                  cols={36}
                  rowHeight={12}
                  width={1200}
                  droppingItem={{ i: 'new', w: 5, h: 5 }}
                  onDrop={onDrop}
                  autoSize={false}
                  compactType={null}
                  isDroppable={!isContentBeingDragged}
                >
                    {layout.map(box => {
                        var contentType = layoutContent[box.i] && getContentType(layoutContent[box.i], contentTypes)

                        return <div key={box.i}>
                            <DroppableContentContainer id={box.i}
                                contentType={contentType}
                                editableProps={editableProps}

                                onRemove={onRemove}
                                layoutContent={layoutContent}
                                updateLayoutContent={updateLayoutContent}
                                contentFormatting={formatting}

                                selectedContent={selectedContent}
                                toggleSelectedContent={toggleSelectedContent}
                                // selectContent={setSelectedContent}

                                experimentLock={lockedContent ? lockedContent.layoutContent.indexOf(box.i) !== -1 : false}

                                currentEvents={currentEvents}
                            />
                        </div>
                    })}
                </GridLayout>
                {<style jsx global>{`
                    .${styles.GridLayoutWrapper} .react-grid-item.react-grid-placeholder {
                        background-color: rgb(226 232 240);
                    }
                    .${styles.GridLayoutWrapper} .react-grid-layout {
                        min-height: calc(100vh - 3rem - 20px)
                    }
                `}</style>}
            </div> : null}

        </div>
        <div className='flex-none w-64 bg-gray-100 p-4'>
            <div className="flex flex-col h-full">
                <div className="flex-grow">
                    <div className="text-lg mb-3 font-bold">{selectedContent?.name}</div>

                    {formattingPanelAdditions ? formattingPanelAdditions(selectedContent, toggleSelectedContent) : null}

                    {selectedContent && !getContentType(selectedContent, contentTypes).disableFormatting ? <Formatting
                        selectedContent={selectedContent}
                        contentFormatting={formatting}
                        update={(property, value) => updateFormatting(selectedContent.name, property, value)}
                    /> : null}
                </div>

                <div>
                    <Switch.Group as="div" className="flex items-center">
                        <Switch
                          checked={showContentLabels}
                          onChange={enabled => editableProps.setContentSettings(
                              { ...editableProps.contentSettings, all: { ...(editableProps.contentSettings.all || {}), showContentLabels: enabled } })}
                          className={`${
                            showContentLabels ? 'bg-blue-600' : 'bg-gray-200'
                          } relative inline-flex h-6 w-11 items-center rounded-full`}
                        >
                          <span className="sr-only">Show block labels</span>
                          <span
                            className={`${
                              showContentLabels ? 'translate-x-6' : 'translate-x-1'
                            } inline-block h-4 w-4 transform rounded-full bg-white transition`}
                          />
                        </Switch>

                      <Switch.Label as="span" className="ml-3">
                        <span className="text-sm font-medium text-gray-900">Show block labels</span>
                      </Switch.Label>
                    </Switch.Group>
                </div>
            </div>

        </div>
    </div>
}


const Formatting = ({ selectedContent, contentFormatting, update }) => {
    var properties =  [
        { name: 'Font size', property: 'fontSize', type: 'text', valueType: 'number' },
        { name: 'Text align', property: 'textAlign', type: 'select', valueType: 'string' },
        { name: 'Inline', property: 'display', type: 'checkbox', valueType: 'string', selectedValue: 'inline-block' }
    ]

    return <div>
        <h3 className="text-md font-medium leading-10">Formatting</h3>
        {properties.map((prop, i) => <FormattingProperty {...prop} key={i}
            content={selectedContent}
            update={update}
            value={contentFormatting && contentFormatting[selectedContent?.name] && contentFormatting[selectedContent.name][prop.property]}
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
      if (content.name && contentRef.current !== content.name){
          updateValueEls(valueType, value)
      }

      contentRef.current = content.name
  }, [content.name])

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
         body = <input type='text' ref={elRef} className="py-0.5 px-1 border-slate-200 hover:border-slate-400"
            defaultValue={valueType === 'number' ? value && parseFloat(value) : value}
            onChange={applyFormatting}
        />
    } else if (type === 'select'){
        body = <select defaultValue={value} ref={elRef} className="py-0.5 px-1 pr-8 border-slate-200 hover:border-slate-400"
            onChange={applyFormatting}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
        </select>
    } else if (type === 'checkbox'){
        body = <input type='checkbox' ref={elRef} className="border-slate-200 hover:border-slate-400"
            defaultChecked={value}
            onChange={applyFormatting}
        />
    }

    return <div className="text-sm mb-1">
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
            <div className='border border-white h-12 w-full opacity-70'></div>
            <div className='text-sm mt-2 leading-2'>{name}</div>
        </div>
    )
}


const DroppableContentContainer = ({ id, onRemove, updateLayoutContent, layoutContent, selectedContent, toggleSelectedContent, selectContent, contentFormatting, experimentLock, contentType, editableProps, currentEvents}) => {
    var layoutContentRef = useRef()

    useEffect(() => {
        layoutContentRef.current = layoutContent
    }, [layoutContent])

    const [{ canDrop, isOver }, dropRef] = useDrop(() => ({
        accept: 'content',
        drop: (item) => {
            var numberOfSuchContentAlreadyCreated = 0
            for (var layoutID in layoutContentRef.current){
                var nameMatch = layoutContentRef.current[layoutID].name.match(new RegExp(`${item.id} (?<number>\\d)`))
                if (nameMatch){
                    numberOfSuchContentAlreadyCreated = nameMatch.groups.number
                } else if (layoutContentRef.current[layoutID].name === item.id){
                    numberOfSuchContentAlreadyCreated = 1
                }
            }

            updateLayoutContent(id, { name: numberOfSuchContentAlreadyCreated ? (
                `${item.id} ${numberOfSuchContentAlreadyCreated + 1}`) : item.id, kind: item.id })
            return ({ name: 'Droppable-Content' });
        },
        collect: (monitor) => ({
          isOver: monitor.isOver(),
          canDrop: monitor.canDrop(),
      }),
    }))

    var content = layoutContent[id],
        settings = content && editableProps?.contentSettings[content.name] || {},
        setSettings = value => editableProps.setContentSettings({ ...editableProps.contentSettings, [content.name]: { ...settings, ...value } })

    var isSelected = selectedContent && content && selectedContent.name === content.name,
        isClicked = content && currentEvents === content.name

    var responsePropertiesEl = []
    if (layoutContent.hasOwnProperty(id) && contentType?.responseProperties){
        contentType.responseProperties.forEach(rp => {
            var body = `.${rp}`

            if (rp instanceof Array){
                body = <>
                    <span>.{rp[0]} {rp[1] instanceof Array ? <span className="italic">[number]</span> : null}</span>
                    {(rp[1] instanceof Array ? rp[1] : rp[1][0]).map(subRP => <div className="pl-4" key={subRP}>.{subRP}</div>)}
                </>
            }

            responsePropertiesEl.push(<div key={rp} className="pl-2 text-xs">{body}</div>)
        })
    }

    return <div
        className={classNames("h-full relative border", isOver ? "bg-slate-200" : '',
            content ? ('hover:border-blue-500' + (isSelected ? ' border-blue-300' : '')) : 'border-dashed border-2 border-gray-200 hover:border-gray-400',
            isClicked ? 'border-red-300' : ''
        )}
        ref={dropRef}
    >
        {layoutContent.hasOwnProperty(id) ? <>
            {experimentLock ? <div>DONT TOUCH ME I AM LOCKED BY A GROUP CHANGE</div> : null}

            {editableProps?.contentSettings?.all?.showContentLabels ? <div title='Click to copy' onClick={e => {
                navigator.clipboard.writeText(`{${content.name}}`);
                e.stopPropagation()
            }} className='absolute right-0 bg-yellow-600 text-white text-sm leading-4 p-1 rounded-r-md' style={{ left: '100%', width: (Math.log10(content.name.length) * 125) + 'px' }}>
                <div>{`{${content.name}}`}</div>
                {responsePropertiesEl}
            </div> : null}

            <EditableContent content={layoutContent[id]} id={id}
                updateLayoutContent={updateLayoutContent}
                toggleSelectedContent={toggleSelectedContent}
                selectContent={selectContent}
                isSelected={isSelected}
                contentFormatting={contentFormatting}

                contentType={contentType}
                settings={settings}
                setSettings={setSettings}
                editableProps={editableProps}
            />

            {isClicked ? <div className='absolute bg-red-300 pointer-events-none' style={{ height: '100%', width: '100%', top: 0, opacity: 0.4 }} /> : null}

            <div className='absolute' style={{ bottom: '-2rem'}}>
                <button onClick={() => updateLayoutContent(id)}
                    className="inline-flex items-center rounded border border-transparent bg-sky-300 px-1.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >Remove &quot;{content.name}&quot;</button>
            </div>


            {contentType && contentType.option ? contentType.option(id, {settings, setSettings}) : null}
        </> : null}
        <div className='absolute right-0' style={{ bottom: '-2rem'}}>
            <button onClick={() => onRemove(id)}
                className="inline-flex items-center rounded border border-transparent bg-gray-300 px-1.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >Remove</button>
        </div>
    </div>
}


// toggleSelectedResourceTemplateItems,
const EditableContent = ({ content, id, updateLayoutContent, toggleSelectedContent, selectContent, isSelected, contentFormatting, contentType, settings, setSettings, editableProps }) => {
    var body = content.name;
    var formatting = contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {}

    body = contentType.editable(
        // body
        content && content.body,

        // formatting.
        formatting,

        {
            updateBody: body => updateLayoutContent(id, { body }),

            toggleSelectedContent: (selected) => toggleSelectedContent(selected || { name: content.name, kind: content.kind }),
            selectContent: () => selectContent({ name: content.name, kind: content.kind }),
            isSelected,

            contentFormatting, settings, setSettings, ...editableProps
        }
    )

    return <div className='h-full'
        data-contentname={content.name}
        style={{ ...formatting }}
        onClick={(e) => {
            toggleSelectedContent({ name: content.name, kind: content.kind || content.name })
            e.stopPropagation()
        }}>
        {body}
    </div>
}


export default WYSIWYGPanelsDraggable
