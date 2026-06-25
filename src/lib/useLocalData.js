import { useEffect, useRef, useState } from 'react'
import { hasMeaningfulData, loadCloudData, loadData, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
  const initialLocalData = useRef(loadData())
  const hasLoadedCloud = useRef(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const cloudData = await loadCloudData()
      if (cancelled) return
      if (cloudData) {
        setData(cloudData)
        saveData(cloudData)
      } else if (hasMeaningfulData(initialLocalData.current)) {
        await saveCloudData(initialLocalData.current)
      }
      hasLoadedCloud.current = true
    }

    hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    saveData(data)

    if (!hasLoadedCloud.current) return

    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      saveCloudData(data)
    }, 450)

    return () => window.clearTimeout(saveTimer.current)
  }, [data])

  function updateData(updater) {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveData(next)
      if (hasLoadedCloud.current) {
        saveCloudData(next).then(result => {
          if (!result?.ok) console.error('RESTAPAY Supabase sync failed', result?.error || result?.reason)
        })
      }
      return next
    })
  }

  return [data, updateData]
}
