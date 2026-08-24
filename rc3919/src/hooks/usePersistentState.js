import { useCallback, useEffect, useState } from 'react'
import { ensureLiveCollection, getLiveCollection, isLiveKey, replaceLiveCollection, subscribeLiveData } from '../data/liveDataStore.js'

export default function usePersistentState(key, initialValue) {
  const live = isLiveKey(key)
  const [value, setValue] = useState(() => live ? getLiveCollection(key) : (()=>{try{const stored=localStorage.getItem(key);return stored?JSON.parse(stored):initialValue}catch{return initialValue}})())
  useEffect(()=>{
    if(!live) return
    let active=true
    ensureLiveCollection(key).then(rows=>active&&setValue(rows)).catch(()=>{})
    return subscribeLiveData(()=>active&&setValue(getLiveCollection(key)))
  },[key,live])
  useEffect(()=>{if(live)return;try{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent('restapay:data-change',{detail:{key}}))}catch{}},[key,value,live])
  const update=useCallback((next)=>{
    if(!live){setValue(next);return Promise.resolve()}
    const current=getLiveCollection(key)
    const resolved=typeof next==='function'?next(current):next
    setValue(resolved)
    return replaceLiveCollection(key,resolved)
  },[key,live])
  return [value,update]
}
