import { useCallback, useEffect, useState } from 'react'
import { ensureLiveCollection, ensureLiveSetting, getLiveCollection, getLiveSetting, isLiveKey, isLiveSettingKey, replaceLiveCollection, replaceLiveSetting, subscribeLiveData } from '../data/liveDataStore.js'

export default function usePersistentState(key, initialValue) {
  const live = isLiveKey(key)
  const liveSetting = isLiveSettingKey(key)
  const [value, setValue] = useState(() => live ? getLiveCollection(key) : liveSetting ? getLiveSetting(key,initialValue) : (()=>{try{const stored=localStorage.getItem(key);return stored?JSON.parse(stored):initialValue}catch{return initialValue}})())
  useEffect(()=>{
    if(!live && !liveSetting) return
    let active=true
    if(live) ensureLiveCollection(key).then(rows=>active&&setValue(rows)).catch(()=>{})
    else ensureLiveSetting(key,initialValue).then(next=>active&&setValue(next)).catch(()=>{})
    return subscribeLiveData(()=>active&&setValue(live?getLiveCollection(key):getLiveSetting(key,initialValue)))
  },[key,live,liveSetting])
  useEffect(()=>{if(live||liveSetting)return;try{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent('restapay:data-change',{detail:{key}}))}catch{}},[key,value,live,liveSetting])
  const update=useCallback((next)=>{
    if(!live && !liveSetting){setValue(next);return Promise.resolve()}
    const current=live?getLiveCollection(key):getLiveSetting(key,initialValue)
    const resolved=typeof next==='function'?next(current):next
    setValue(resolved)
    return live?replaceLiveCollection(key,resolved):replaceLiveSetting(key,resolved,initialValue)
  },[key,live,liveSetting,initialValue])
  return [value,update]
}
