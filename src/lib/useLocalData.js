import { useEffect, useRef, useState } from 'react'
import { announceCloudStatus, loadCloudData, loadData, retryPendingCloudSave, saveCloudData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())
  const hasLoadedCloud = useRef(false)
  const saveQueue = useRef(Promise.resolve())
  const latestData = useRef(data)

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
      window.__restapayCloudHydrated = true
      retryPendingCloudSave().catch(error => console.error('Unable to retry pending cloud save.', error))
    }

    hydrate()
    const reconnect = () => {
      if (cancelled || !navigator.onLine || window.__restapayCloudSavePending) return
      loadCloudData().then(cloudData => {
        if (!cancelled && cloudData) {
          latestData.current = cloudData
          setData(cloudData)
          saveData(cloudData)
        }
      }).catch(() => {})
    }
    window.addEventListener('online', reconnect)
    window.addEventListener('focus', reconnect)
    const timer = window.setInterval(reconnect, 60000)
    return () => {
      cancelled = true
      window.removeEventListener('online', reconnect)
      window.removeEventListener('focus', reconnect)
      window.clearInterval(timer)
    }
  }, [])

  function updateData(updater) {
    setData(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      latestData.current = next
      saveData(next)
      window.__restapayCloudSavePending = true
      if (!hasLoadedCloud.current) {
        announceCloudStatus('saving', { message: 'Connecting to Supabase and queuing this save.' })
      }
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(async () => {
          if (!hasLoadedCloud.current) {
            for (let attempt = 0; attempt < 20 && !hasLoadedCloud.current; attempt += 1) {
              await new Promise(resolve => setTimeout(resolve, 250))
            }
          }
          const snapshot = latestData.current
          const result = await saveCloudData(snapshot, { source: 'serialized-direct-save' })
          if (!result?.ok) console.error('RESTAPAY direct database save failed', result?.error || result?.reason)
          return result
        })
      return next
    })
  }

  return [data, updateData]
}
