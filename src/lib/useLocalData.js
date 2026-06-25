import { useEffect, useRef, useState } from 'react'
import { loadCloudData, loadData, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
  const hasLoadedCloud = useRef(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const localData = loadData()
      const cloudData = await loadCloudData()
      if (cancelled) return

      if (cloudData) {
        setData(cloudData)
        saveData(cloudData)
      } else {
        // If this browser already has invoices/items in localStorage but Supabase is empty,
        // push the local data up once so existing saved items appear in Supabase tables.
        await saveCloudData(localData)
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
    setData(prev => typeof updater === 'function' ? updater(prev) : updater)
  }

  return [data, updateData]
}
