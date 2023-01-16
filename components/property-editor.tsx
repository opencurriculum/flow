import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import update from 'immutability-helper'
import { PlusIcon, XMarkIcon } from '@heroicons/react/20/solid'


export default function PropertyEditor({ selectedContent, properties, value, setValue }){
    const [data, setData] = useState(value || {})
    const selectedContentRef = useRef(selectedContent)
    const [focused, setFocused] = useState(false)

    var onFocus = e => setFocused(true),
        onBlur = e => setFocused(false)

    useEffect(() => {
        if (data && Object.keys(data).length){
            setValue(data)
        }
    }, [data])

    useEffect(() => {
        setData(value || {})
        selectedContentRef.current = selectedContent
    }, [selectedContent])

    var setItem = (propertiesIndex, itemID, propertyTitle, value) => {
        var propertyIndex
        if (properties[propertiesIndex].kind === 'list'){
            if (properties[propertiesIndex].items.kind === 'object'){
                propertyIndex = data[propertiesIndex].value[itemID].items.findIndex(p => p.title === propertyTitle)
                setData(update(data, { [propertiesIndex]: { value: { [itemID]: { items: { [propertyIndex]: { value: { $set: value } } } } } } }))
            } else if (["string", "text"].indexOf(properties[propertiesIndex].items.kind) !== -1){
                setData(update(data, { [propertiesIndex]: { value: { [itemID]: { value: { $set: value } } } } }))
            }
        } else if (["string", "text", "boolean"].indexOf(properties[propertiesIndex].kind) !== -1){
            setData(update(data, { [propertiesIndex]: { $set: { id: properties[propertiesIndex].id, value } } }))
        }
    }

    var deleteItem = (propertiesIndex, itemID) => {
        if (properties[propertiesIndex].kind === 'list'){
            setData(update(data, { [propertiesIndex]: { value: { $unset: [itemID] } } }))
        }
    }

    return <div>
        {properties.map((property, i) => {
            var body
            if (property.kind === 'list'){
                body = [
                    <div key={0}>{data && data[i] && Object.keys(data[i].value).map(id => data[i].value[id]).sort((a, b) => a.position - b.position).map((listItem, j) => <ListItem
                        propertiesIndex={i}
                        key={j} index={j} item={listItem} properties={property.items}
                        setItem={setItem} deleteItem={deleteItem}
                        defaultValue={value && value[i]?.value?.[listItem.id]}
                    />)}</div>,
                    <div key={1}><button
                        type="button"
                        className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        onClick={() => {
                        if (property.items.kind === "object"){
                            setData(data => {
                                if (!data || !data[i]){
                                    data[i] = { id: property.id, value: {} }
                                }

                                var id = uuidv4().substring(0, 8)
                                data[i].value[id] = {
                                    id,
                                    position: Object.keys(data[i].value) ? Object.keys(data[i].value).length : 0,
                                    kind: "object",
                                    items: property.items.items.map(item => ({
                                        ...item, value: null
                                    }))
                                }

                                return { ...data }
                            })
                        } else if (["string", "text"].indexOf(property.items.kind) !== -1){
                            setData(data => {
                                if (!data || !data[i]){
                                    data[i] = { id: property.id, value: {} }
                                }

                                var id = uuidv4().substring(0, 8)
                                data[i].value[id] = {
                                    id,
                                    position: Object.keys(data[i].value) ? Object.keys(data[i].value).length : 0,
                                    kind: property.items.kind,
                                    value: null
                                }

                                return { ...data }

                            })
                        }
                    }}>
                        <PlusIcon className="-ml-0.5 mr-1 h-3 w-3" aria-hidden="true" />
                        Add
                    </button></div>
                ]
            } else if (["string", "text"].indexOf(property.kind) !== -1){
                body = <SingleProperty
                    property={property} setValue={(propertyTitle, value) => {
                        setItem(i, null, null, value)
                    }}
                    defaultValue={value && value[i]?.value || ''}
                    focused={focused} onFocus={onFocus} onBlur={onBlur}
                />
            } else if (property.kind === 'boolean'){
                body = <SingleProperty
                    property={property} setValue={(propertyTitle, value) => {
                        setItem(i, null, null, value)
                    }}
                    defaultValue={value && value[i]?.value || false}
                    focused={focused} onFocus={onFocus} onBlur={onBlur}
                />
            }


            return <div key={property.title}>
                {['object', 'list'].indexOf(property.kind) !== -1 ? <div>{property.title}</div> : null}
                {body}
            </div>
        })}
    </div>
}


const ListItem = ({ propertiesIndex, item, setItem, deleteItem, defaultValue }) => {
    const [focused, setFocused] = useState(false)

    var setValue = (propertyTitle, value) => {
        setItem(propertiesIndex, item.id, propertyTitle, value)
    }

    var onFocus = e => setFocused(true),
        onBlur = e => setFocused(false)

    return <div>
        <div className='flex'>
            <div>
                {item.kind === "object" ? item.items.map((property, i) => <SingleProperty
                    key={property.title} property={property} setValue={setValue}
                    defaultValue={defaultValue?.items && defaultValue.items[i]?.value}
                    focused={focused} onFocus={onFocus} onBlur={onBlur}
                />) : null}
                {["string", "text", "integer"].indexOf(item.kind) !== -1 ? <SingleProperty
                    key={item.title} property={item} setValue={setValue}
                    defaultValue={defaultValue?.value}
                    focused={focused} onFocus={onFocus} onBlur={onBlur}
                /> : null}
            </div>
            <div className='flex items-center'>
                <button
                  onClick={e => deleteItem(propertiesIndex, item.id)}
                  type="button"
                  className="inline-flex items-center rounded-full p-1 text-gray-400 hover:text-gray-600 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                >
                    <XMarkIcon className="-ml-0.5 h-6 w-6" aria-hidden="true" />
                </button>
            </div>
        </div>
        {/*focused ? */<div className='text-xs text-gray-400 my-1'>ID: {item.id}</div>/* : null*/}
    </div>
}


const SingleProperty = ({ property, setValue, defaultValue, onFocus, onBlur, focused }) => {
    const inputRef = useRef()

    useEffect(() => {
        if (inputRef.current !== document.activeElement && defaultValue !== inputRef.current.value){
            if (['text', 'string', 'integer'].indexOf(property.kind) !== -1){
                inputRef.current.value = defaultValue
            } else if (property.kind === 'boolean'){
                inputRef.current.checked = defaultValue === true
            }
        }
    }, [defaultValue])

    var onInputBlur = e => {
        onBlur()
        setValue(property.title, e.target.value)
    }

    var body
    if (property.kind === 'text'){
        body = [
            <div key='title'>{property.title}</div>,
            <div key='body'><textarea ref={inputRef} onBlur={onInputBlur} /></div>
        ]
    } else if (property.kind === 'boolean'){
        body = <div>
            <input key='body' type="checkbox" ref={inputRef}
                onChange={e => setValue(property.title, e.target.checked)} />
            <label key='title' className="ml-1">{property.title}</label>
        </div>
    } else {
        body = [
            <div key='body'>{property.title}</div>,
            <div key='title'><input type="text" onFocus={onFocus} ref={inputRef} onBlur={onInputBlur} /></div>,
        ]
    }

    return <div className="mt-2">
        {body}
    </div>
}
