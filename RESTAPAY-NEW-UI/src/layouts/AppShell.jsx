import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { useFeedback } from '../components/AppFeedback'

const quickRoutes = {
  'Import Sales':'/import-center','Import Labor':'/import-center','Product Mix':'/import-center','Toast Sync':'/toast-integration',
  'View all':'/reports','Settings':'/settings','Sync Now':'/toast-integration'
}

export default function AppShell() {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const handleFallback = (event) => {
    const button = event.target.closest('button')
    if (!button || button.disabled || button.dataset.handled === 'true') return
    const label = button.getAttribute('aria-label') || button.textContent?.trim()
    if (!label) return
    if (quickRoutes[label]) { event.preventDefault(); navigate(quickRoutes[label]); return }
    if (['1','2','3'].includes(label)) return
    window.setTimeout(() => {
      if (!event.defaultPrevented && !document.querySelector('.modal-layer,.drawer-layer')) notify(`${label} action is available. Data connection will be enabled during the engine phase.`, 'info')
    }, 0)
  }
  return <div className="app-shell" onClickCapture={handleFallback}><Sidebar/><div className="app-main"><Topbar/><main className="page-canvas"><Outlet/></main></div></div>
}
