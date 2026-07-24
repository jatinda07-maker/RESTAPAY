import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CostAnalysis from './pages/CostAnalysis'
import EntityPage from './pages/EntityPage'
import Employees from './pages/Employees'
import Payroll from './pages/Payroll'
import ApprovedPayroll from './pages/ApprovedPayroll'
import Vendors from './pages/Vendors'
import VendorComparison from './pages/VendorComparison'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import MenuCosting from './pages/MenuCosting'
import MenuIntelligence from './pages/MenuIntelligence'
import ImportCenter from './pages/ImportCenter'
import ToastIntegration from './pages/ToastIntegration'
import Diagnostics from './pages/Diagnostics'
import { diagnosticLogger, installGlobalDiagnostics } from './lib/diagnostics'
import { useLocalData } from './lib/useLocalData'
import './styles.css'

installGlobalDiagnostics()

function App() {
  const [active, setActiveState] = useState('dashboard')
  const setActive = next => {
    if (active === 'payroll' && next !== 'payroll' && next !== 'approved-payroll' && window.__restapayCloudSavePending) {
      const leave = window.confirm('Payroll changes have not been saved to Supabase. Leave this screen and lose the unsaved changes?')
      if (!leave) return
    }
    diagnosticLogger.info('Navigation', `Opened ${next}`, { from: active, to: next })
    setActiveState(next)
  }

  useEffect(() => {
    const handleFocus = event => {
      const input = event.target
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return
      if (input.readOnly || input.disabled || ['date', 'file', 'checkbox', 'radio', 'color'].includes(input.type)) return
      // Search fields clear immediately on click or Tab, as requested.
      // Other entry fields select their current value so the next keystroke replaces it.
      requestAnimationFrame(() => {
        const isSearchField = input.type === 'search' || /search/i.test(String(input.placeholder || '')) || input.dataset.clearOnFocus === 'true'
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        if (isSearchField) {
          if (input.value) {
            setter?.call(input, '')
            input.dispatchEvent(new Event('input', { bubbles: true }))
          }
          input.setSelectionRange?.(0, 0)
        } else if (/^-?0+(\.0+)?$/.test(String(input.value || '').trim())) {
          setter?.call(input, '')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        } else {
          input.select?.()
        }
      })
    }
    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])
  const [data, setData] = useLocalData()
  const shared = { data, setData }

  return <Layout active={active} setActive={setActive}>
    {active === 'dashboard' ? <Dashboard data={data} setData={setData} setActive={setActive} />
      : active === 'cost-analysis' ? <CostAnalysis {...shared} />
      : active === 'import-center' ? <ImportCenter {...shared} setActive={setActive} />
      : active === 'toast-integration' ? <ToastIntegration />
      : active === 'employees' ? <Employees {...shared} />
      : active === 'sales' ? <Sales {...shared} />
      : active === 'menu-costing' ? <MenuCosting {...shared} />
      : active === 'menu-intelligence' ? <MenuIntelligence {...shared} />
      : active === 'vendors' ? <Vendors {...shared} />
      : active === 'vendor-comparison' ? <VendorComparison {...shared} />
      : active === 'invoices' ? <Invoices {...shared} />
      : active === 'payroll' ? <Payroll {...shared} setActive={setActive} />
      : active === 'approved-payroll' ? <ApprovedPayroll {...shared} />
      : active === 'expenses' ? <Expenses {...shared} />
      : active === 'reports' ? <Reports {...shared} />
      : active === 'diagnostics' ? <Diagnostics {...shared} />
      : active === 'settings' ? <Settings {...shared} />
      : <EntityPage page={active} />}
  </Layout>
}

createRoot(document.getElementById('root')).render(<App />)
