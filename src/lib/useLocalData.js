import { useEffect, useRef, useState } from 'react'
import { announceCloudStatus, loadCloudData, loadData, retryPendingCloudSave, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
  const hasLoadedCloud = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      const cloudData = await loadCloudData()
      if (cancelled) return
      if (cloudData) {
        setData(cloudData)
        saveData(cloudData)
      } else {
        announceCloudStatus('offline', { message: 'Unable to load Supabase data. Local recovery data remains available.' })
      }
      hasLoadedCloud.current = true
      retryPendingCloudSave().catch(error => console.error('Unable to retry pending cloud save.', error))
    }

    hydrate()
    return () => { cancelled = true }
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
        window.__restapayCloudSavePending = true
        announceCloudStatus('saving', { message: 'Waiting for Supabase initialization before saving.' })
      }
      return next
    })
  }

  return [data, updateData]
}
