import { useEffect, useState } from 'react'
export default function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) : initialValue } catch { return initialValue }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      window.dispatchEvent(new CustomEvent('restapay:data-change', { detail: { key } }))
    } catch {}
  }, [key, value])
  return [value, setValue]
}
