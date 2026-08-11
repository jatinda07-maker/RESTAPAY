import { Outlet, useNavigate } from 'react-router-dom'
import { useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'

const quickRoutes = {
  'Import Sales':'/import-center','Import Labor':'/import-center','Product Mix':'/import-center','Toast Sync':'/toast-integration',
  'View all':'/reports','Settings':'/settings','Sync Now':'/toast-integration'
}

export default function AppShell() {
  const navigate = useNavigate()
  const openDatePicker = useCallback((event) => {
    const direct = event.target?.matches?.('input[type="date"]') ? event.target : null
    const wrapper = event.target?.closest?.('label, .compact-date-field')
    const input = direct || wrapper?.querySelector?.('input[type="date"]')
    if (!input || input.disabled || input.readOnly) return
    try { if (typeof input.showPicker === 'function') input.showPicker(); else input.focus() } catch { input.focus() }
  }, [])
  const handleFallback = (event) => {
    const button = event.target.closest('button')
    if (!button || button.disabled || button.dataset.handled === 'true') return
    const label = button.getAttribute('aria-label') || button.textContent?.trim()
    if (!label) return
    if (quickRoutes[label]) { event.preventDefault(); navigate(quickRoutes[label]); return }
    if (['1','2','3'].includes(label)) return
  }
  return <div className="app-shell" onPointerDownCapture={openDatePicker} onClickCapture={handleFallback}><Sidebar/><div className="app-main"><Topbar/><main className="page-canvas"><Outlet/></main></div></div>
}
