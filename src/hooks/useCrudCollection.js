import { useCallback, useMemo } from 'react'
import usePersistentState from './usePersistentState'
import { isLiveKey, replaceLiveCollection } from '../data/liveDataStore.js'

const makeId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function useCrudCollection(key, initialRows = []) {
  const [rows, setRows] = usePersistentState(key, initialRows)
  const commit = useCallback(async updater => {
    if (isLiveKey(key)) return replaceLiveCollection(key, updater)
    setRows(updater)
  }, [key, setRows])

  const api = useMemo(() => ({
    add: async record => {
      const created = { ...record, id: record.id || makeId() }
      await commit(current => [...(Array.isArray(current) ? current : []), created])
      return created
    },
    update: async (id, patch) => {
      await commit(current => (Array.isArray(current) ? current : []).map(row => row.id === id ? { ...row, ...patch } : row))
    },
    remove: async id => {
      await commit(current => (Array.isArray(current) ? current : []).filter(row => row.id !== id))
    },
    reset: async () => commit(initialRows),
  }), [commit, initialRows])
  return [rows, api, setRows]
}
