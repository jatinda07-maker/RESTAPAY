import { useEffect, useRef, useState } from 'react'
import { announceCloudStatus, hasMeaningfulData, loadCloudData, loadData, mergeCloudAndLocalData, retryPendingCloudSave, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
  const initialLocalData = useRef(loadData())
  const hasLoadedCloud = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const cloudData = await loadCloudData()
      if (cancelled) return
      if (cloudData) {
        const safeMerged = mergeCloudAndLocalData(cloudData, initialLocalData.current)
        setData(safeMerged)
        saveData(safeMerged)
        if (hasMeaningfulData(initialLocalData.current)) {
          await saveCloudData(safeMerged, { source: 'startup-safe-merge' })
        }
      } else if (hasMeaningfulData(initialLocalData.current)) {
        await saveCloudData(initialLocalData.current, { source: 'startup-local-backup' })
      }
      await retryPendingCloudSave()
      hasLoadedCloud.current = true
    }

    hydrate()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    function retry() { retryPendingCloudSave() }
    function handleVisibility() { if (document.visibilityState === 'visible') retry() }
    window.addEventListener('online', retry)
    window.addEventListener('focus', retry)
    document.addEventListener('visibilitychange', handleVisibility)
    const timer = window.setInterval(retry, 60000)
    return () => {
      window.removeEventListener('online', retry)
      window.removeEventListener('focus', retry)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.clearInterval(timer)
    }
  }, [])

  function updateData(updater) {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveData(next)
      if (hasLoadedCloud.current) {
        saveCloudData(next, { source: 'direct-save' }).then(result => {
          if (!result?.ok) console.error('RESTAPAY direct database save failed', result?.error || result?.reason)
        })
      } else {
        announceCloudStatus('local', { message: 'Local backup saved. Cloud save starts after database load finishes.' })
      }
      return next
    })
  }

  return [data, updateData]
}
