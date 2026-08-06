import { useMemo } from 'react'
import usePersistentState from './usePersistentState'

export default function useCrudCollection(key, initialRows = []) {
  const [rows, setRows] = usePersistentState(key, initialRows)
  const api = useMemo(() => ({
    add: (record) => setRows((current) => [...current, { ...record, id: record.id || `${Date.now()}-${Math.random().toString(36).slice(2)}` }]),
    update: (id, patch) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row)),
    remove: (id) => setRows((current) => current.filter((row) => row.id !== id)),
    reset: () => setRows(initialRows),
  }), [initialRows, setRows])
  return [rows, api, setRows]
}
