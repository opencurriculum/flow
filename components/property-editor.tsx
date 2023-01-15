import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import update from 'immutability-helper'
import { PlusIcon } from '@heroicons/react/20/solid'


export default function PropertyEditor({ selectedContent, properties, value, setValue }){
    const [data, setData] = useState(value || {})
    const selectedContentRef = useRef(selectedContent)

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

    return <div>
        {properties.map((property, i) => {
            var body
            if (property.kind === 'list'){
                body = [
                    <div key={0}>{data && data[i] && Object.keys(data[i].value).map(id => data[i].value[id]).sort((a, b) => a.position - b.position).map((listItem, j) => <ListItem
                        propertiesIndex={i}
                        key={j} index={j} item={listItem} properties={property.items}
                        setItem={setItem}
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
                                    position: Object.keys(data[i]).length,
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
                                    position: Object.keys(data[i]).length,
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
                    defaultValue={value && value[0]?.value || ''}
                />
            } else if (property.kind === 'boolean'){
                body = <SingleProperty
                    property={property} setValue={(propertyTitle, value) => {
                        setItem(i, null, null, value)
                    }}
                    defaultValue={value && value[0]?.value || false}
                />
            }


            return <div key={property.title}>
                {['object', 'list'].indexOf(property.kind) !== -1 ? <div>{property.title}</div> : null}
                {body}
            </div>
        })}
    </div>
}


const ListItem = ({ propertiesIndex, item, setItem, defaultValue }) => {
    var setValue = (propertyTitle, value) => {
        setItem(propertiesIndex, item.id, propertyTitle, value)
    }

    return <div>
        {item.kind === "object" ? item.items.map((property, i) => <SingleProperty
            key={property.title} property={property} setValue={setValue}
            defaultValue={defaultValue?.items && defaultValue.items[i]?.value}
        />) : null}
        {["string", "text", "integer"].indexOf(item.kind) !== -1 ? <SingleProperty
            key={item.title} property={item} setValue={setValue}
            defaultValue={defaultValue?.value}
        /> : null}

    </div>
}


const SingleProperty = ({ property, setValue, defaultValue }) => {
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

    var onBlur = e => setValue(property.title, e.target.value)

    var body
    if (property.kind === 'text'){
        body = [
            <div>{property.title}</div>,
            <div><textarea ref={inputRef} onBlur={onBlur} /></div>
        ]
    } else if (property.kind === 'boolean'){
        body = <div>
            <input type="checkbox" ref={inputRef}
                onChange={e => setValue(property.title, e.target.checked)} />
            <label className="ml-1">{property.title}</label>
        </div>
    } else {
        body = [
            <div>{property.title}</div>,
            <div><input type="text" ref={inputRef} onBlur={onBlur} /></div>
        ]
    }

    return <div className="mt-2">
        {body}
    </div>
}
