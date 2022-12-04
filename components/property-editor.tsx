import { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import update from 'immutability-helper'


export default function PropertyEditor({ properties, value, setValue }){
    const [data, setData] = useState(value || [])

    useEffect(() => {
        if (data?.length){
            setValue(data)
        }
    }, [data])

    var setItem = (propertiesIndex, itemID, propertyTitle, value) => {
        var propertyIndex
        if (properties[propertiesIndex].kind === 'list'){
            if (properties[propertiesIndex].items.kind === 'object'){
                propertyIndex = data[propertiesIndex].value[itemID].items.findIndex(p => p.title === propertyTitle)
                setData(update(data, { [propertiesIndex]: { value: { [itemID]: { items: { [propertyIndex]: { value: { $set: value } } } } } } }))
            } else if (["string", "text"].indexOf(properties[propertiesIndex].items.kind) !== -1){
                setData(update(data, { [propertiesIndex]: { value: { [itemID]: { value: { $set: value } } } } }))
            }
        } else if (["string", "text"].indexOf(properties[propertiesIndex].kind) !== -1){
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
                    <div key={1}><button onClick={() => {
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

                                return [ ...data ]
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

                                return [ ...data ]

                            })
                        }
                    }}>+ Add</button></div>
                ]
            } else if (["string", "text"].indexOf(property.kind) !== -1){
                body = <SingleProperty
                    property={property} setValue={(propertyTitle, value) => {
                        setItem(i, null, null, value)
                    }}
                    defaultValue={value && value[0]?.value || ''}
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
            inputRef.current.value = defaultValue
        }
    }, [defaultValue])

    var onBlur = e => setValue(property.title, e.target.value)

    return <div>
        <div>{property.title}</div>
        <div>
            {property.kind === 'text' ? <textarea ref={inputRef} onBlur={onBlur}
                />: <input type="text" ref={inputRef} onBlur={onBlur} />}
        </div>
    </div>
}
