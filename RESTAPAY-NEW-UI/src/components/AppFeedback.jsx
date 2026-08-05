import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

const FeedbackContext = createContext(null)

export function FeedbackProvider({ children }) {
  const [messages, setMessages] = useState([])
  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`
    setMessages((items) => [...items, { id, message, type }])
    window.setTimeout(() => setMessages((items) => items.filter((item) => item.id !== id)), 3200)
  }, [])
  const remove = useCallback((id) => setMessages((items) => items.filter((item) => item.id !== id)), [])
  const value = useMemo(() => ({ notify }), [notify])
  return <FeedbackContext.Provider value={value}>{children}<div className="toast-stack" aria-live="polite">{messages.map((item) => {
    const Icon = item.type === 'error' ? TriangleAlert : item.type === 'info' ? Info : CheckCircle2
    return <div key={item.id} className={`app-toast toast-${item.type}`}><Icon size={18}/><span>{item.message}</span><button onClick={() => remove(item.id)} aria-label="Dismiss"><X size={15}/></button></div>
  })}</div></FeedbackContext.Provider>
}

export function useFeedback() {
  return useContext(FeedbackContext) || { notify: () => {} }
}
