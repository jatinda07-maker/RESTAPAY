import { useCallback, useEffect, useState } from 'react'
import { ensureLiveCollection, getLiveCollection, isLiveKey, replaceLiveCollection, subscribeLiveData, isLiveSettingKey, getLiveSetting, ensureLiveSetting, replaceLiveSetting } from '../data/liveDataStore.js'

export default function usePersistentState(key, initialValue) {
  const live = isLiveKey(key)
  const liveSetting = isLiveSettingKey(key)
  const [value, setValue] = useState(() => live ? getLiveCollection(key) : liveSetting ? getLiveSetting(key,initialValue) : (()=>{try{const stored=localStorage.getItem(key);return stored?JSON.parse(stored):initialValue}catch{return initialValue}})())
  useEffect(()=>{
    if(!live && !liveSetting) return
    let active=true
    ;(live ? ensureLiveCollection(key) : ensureLiveSetting(key,initialValue)).then(rows=>active&&setValue(rows)).catch(()=>{})
    return subscribeLiveData(e=>{if(!active||e?.detail?.key!==key)return;setValue(live?getLiveCollection(key):getLiveSetting(key,initialValue))})
  },[key,live,liveSetting])
  useEffect(()=>{if(live||liveSetting)return;try{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent('restapay:data-change',{detail:{key}}))}catch{}},[key,value,live,liveSetting])
  const update=useCallback((next)=>{
    if(!live&&!liveSetting){setValue(next);return Promise.resolve()}
    if(liveSetting){const current=getLiveSetting(key,initialValue);const resolved=typeof next==='function'?next(current):next;setValue(resolved);return replaceLiveSetting(key,resolved,initialValue)}
    const current=getLiveCollection(key)
    const resolved=typeof next==='function'?next(current):next
    setValue(resolved)
    return replaceLiveCollection(key,resolved)
  },[key,live,liveSetting,initialValue])
  return [value,update]
}
