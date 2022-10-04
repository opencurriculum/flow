import { useState, useEffect, useRef } from 'react'
import GridLayout from "react-grid-layout"
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { useDrag, useDrop, DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import styles from '../styles/components/StepAdmin.module.sass'
import {Editor, EditorState, ContentState, convertToRaw, convertFromRaw } from 'draft-js';
import 'draft-js/dist/Draft.css';
import {blockStyleFn} from '../utils/common.tsx'


const WYSIWYGPanelsDraggable: NextPageWithLayout = (props) => {
    return <DndProvider backend={HTML5Backend}>
        <WYSIWYGPanels {...props} />
    </DndProvider>;
}


const WYSIWYGPanels = ({ context, layout, onLayoutChange, onDrop, layoutContent,
    updateLayoutContent, formatting, updateFormatting, contentTypes, formattingPanelAdditions, lockedContent }) => {
    const [isContentBeingDragged, setIsContentBeingDragged] = useState(false)
    const [selectedContent, setSelectedContent] = useState()

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

    var contentTypesNames = contentTypes ? Object.keys(contentTypes) : []

    return <div className='flex flex-auto'>
        <div className='flex-none w-64 bg-gray-800 p-6 text-white'>
            {/*<button className='p-2' onClick={() => setLayout(initialLayout)}>Reset layout</button>*/}

            <div className='mb-4'>
                <h3 className="text-lg font-medium leading-10">Layout</h3>

                <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    <div
                      className="droppable-element cursor-pointer col-span-1 divide-y divide-gray-200"
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
                    {(context === 'step' ? [{ name: 'Prompt' }, { name: 'Question' }, { name: 'Response' }, { name: 'Check answer' }] : [{ name: 'Text' }]).map(item => <li key={item.name} className='cursor-pointer'>
                        <div className='border border-white h-12 w-full opacity-70'></div>
                        <DraggableContent name={item.name} onDragBegin={onDragContentBegin} onDragEnd={onDragContentEnd} />
                    </li>)}
                </ul>
            </div>
        </div>

        <div className='flex-auto relative overflow-auto'>
            {layout ? <div className={styles.GridLayoutWrapper + ' absolute'} style={{ width: '800px' }}>
                <GridLayout
                  className="layout"
                  layout={layout}
                  onLayoutChange={onLayoutChange}
                  cols={12}
                  rowHeight={30}
                  width={800}
                  onDrop={onDrop}
                  isDroppable={!isContentBeingDragged}
                >
                    {layout.map(box => {
                        var contentIsCustom = layoutContent[box.i] && contentTypesNames.find(contentTypesName => {
                            return layoutContent[box.i].name.startsWith(contentTypesName)
                        })

                        return <div key={box.i}>
                            <DroppableContentContainer id={box.i}
                                contentType={contentIsCustom ? contentTypes[contentIsCustom] : null}

                                layoutContent={layoutContent}
                                updateLayoutContent={updateLayoutContent}
                                toggleSelectedContent={toggleSelectedContent}
                                contentFormatting={formatting}

                                experimentLock={lockedContent ? lockedContent.layoutContent.indexOf(box.i) !== -1 : false}
                            />
                        </div>
                    })}
                </GridLayout>
                {<style jsx global>{`
                    .${styles.GridLayoutWrapper} .react-grid-item {
                        border: 1px solid #000
                    }
                `}</style>}
            </div> : null}

        </div>
        <div className='flex-none w-64 bg-gray-100 p-4'>
            {formattingPanelAdditions ? formattingPanelAdditions(toggleSelectedContent) : null}

            {selectedContent ? <Formatting
                selectedContent={selectedContent}
                contentFormatting={formatting}
                update={updateFormatting}
            /> : null}

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
        <h3 className="text-lg font-medium leading-10">Formatting</h3>
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
        <div ref={dragRef} style={{ opacity }} className='text-sm leading-8'>
            {name}
        </div>
    )
}


const DroppableContentContainer = ({ id,
        updateLayoutContent, layoutContent, toggleSelectedContent,
        contentFormatting, experimentLock,

        contentType
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
                updateLayoutContent={updateLayoutContent}
                toggleSelectedContent={toggleSelectedContent}
                contentFormatting={contentFormatting}
                contentType={contentType}
            />
            <button onClick={() => updateLayoutContent(id)}>Remove</button>

            {contentType && contentType.option ? contentType.option(id) : null}
        </div> : 'Drop'}
    </div>
}


const EditableContent = ({ content, id,
    // toggleSelectedResourceTemplateItems,
    updateLayoutContent, toggleSelectedContent, contentFormatting, contentType }) => {
    var body = content.name;
    if (contentType){
        if (contentType.editable)
            body = contentType.editable(id, content && content.body)

    } else {
        body = <ContentInput name='text' body={content.body} formatting={contentFormatting && contentFormatting[content.name]} updateBody={(body) => {
            updateLayoutContent(id, { body })
        }} />
    }

    return <div className='border border-transparent border-2 border-dashed hover:border-gray-200' style={{ cursor: 'pointer',
        ...(contentFormatting && contentFormatting[content.name] ? contentFormatting[content.name] : {}),
    }} onClick={() => {
        toggleSelectedContent(content.name)
    }}>
        {body}
    </div>
}


export var ContentInput = ({ name, body, updateBody, formatting }) => {
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


export default WYSIWYGPanelsDraggable
