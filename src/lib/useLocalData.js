import { useEffect, useRef, useState } from 'react'
import { loadCloudData, loadData, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
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
