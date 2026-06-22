import { useEffect, useState } from 'react'
import { loadData, saveData } from './localStore'

export function useLocalData() {
  const [data, setData] = useState(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  function updateData(updater) {
    setData(prev => typeof updater === 'function' ? updater(prev) : updater)
  }

  return [data, updateData]
}
