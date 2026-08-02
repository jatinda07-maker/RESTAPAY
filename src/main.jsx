import React, { Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Layout from './components/Layout'
import { diagnosticLogger, installGlobalDiagnostics } from './lib/diagnostics'
import { useLocalData } from './lib/useLocalData'
import './styles.css'
import './styles/design-system.css'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CostAnalysis = lazy(() => import('./pages/CostAnalysis'))
const EntityPage = lazy(() => import('./pages/EntityPage'))
const Employees = lazy(() => import('./pages/Employees'))
const Payroll = lazy(() => import('./pages/Payroll'))
const Vendors = lazy(() => import('./pages/Vendors'))
const VendorComparison = lazy(() => import('./pages/VendorComparison'))
const Invoices = lazy(() => import('./pages/Invoices'))
const Settings = lazy(() => import('./pages/Settings'))
const Sales = lazy(() => import('./pages/Sales'))
const Reports = lazy(() => import('./pages/Reports'))
const Expenses = lazy(() => import('./pages/Expenses'))
const MenuCosting = lazy(() => import('./pages/MenuCosting'))
const MenuIntelligence = lazy(() => import('./pages/MenuIntelligence'))
const ImportCenter = lazy(() => import('./pages/ImportCenter'))
const ToastIntegration = lazy(() => import('./pages/ToastIntegration'))
const Diagnostics = lazy(() => import('./pages/Diagnostics'))

installGlobalDiagnostics()

function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="page-loading-spinner" aria-hidden="true" />
      <span>Loading workspace...</span>
    </div>
  )
}

const VALID_PAGES = new Set([
  'dashboard', 'sales', 'cost-analysis', 'invoices', 'vendors',
  'vendor-comparison', 'price-increase', 'employees', 'payroll',
  'expenses', 'reports', 'menu-intelligence', 'menu-costing',
  'import-center', 'toast-integration', 'diagnostics', 'settings'
])

function initialActivePage() {
  try {
    const saved = localStorage.getItem('restapay_active_page')
    return VALID_PAGES.has(saved) ? saved : 'dashboard'
  } catch {
    return 'dashboard'
  }
}

function App() {
  const [active, setActiveState] = useState(initialActivePage)
  const setActive = next => {
    const safeNext = VALID_PAGES.has(next) ? next : 'dashboard'
    diagnosticLogger.info('Navigation', `Opened ${safeNext}`, { from: active, to: safeNext })
    try { localStorage.setItem('restapay_active_page', safeNext) } catch {}
    setActiveState(safeNext)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  useEffect(() => {
    const handleDateClick = event => {
      const input = event.target instanceof HTMLInputElement ? event.target : event.target.closest?.('input[type="date"]')
      if (!(input instanceof HTMLInputElement) || input.type !== 'date' || input.disabled || input.readOnly) return
      try { input.showPicker?.() } catch {}
    }
    document.addEventListener('click', handleDateClick)

    const handleFocus = event => {
      const input = event.target
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) return
      if (input.readOnly || input.disabled || ['date', 'file', 'checkbox', 'radio', 'color'].includes(input.type)) return
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
    return () => {
      document.removeEventListener('click', handleDateClick)
      document.removeEventListener('focusin', handleFocus)
    }
  }, [])

  const [data, setData] = useLocalData()
  const shared = { data, setData }

  const page = active === 'dashboard' ? <Dashboard data={data} setData={setData} setActive={setActive} />
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
    : active === 'expenses' ? <Expenses {...shared} />
    : active === 'reports' ? <Reports {...shared} />
    : active === 'diagnostics' ? <Diagnostics {...shared} />
    : active === 'settings' ? <Settings {...shared} />
    : <EntityPage page={active} />

  return (
    <Layout active={active} setActive={setActive}>
      <Suspense fallback={<PageLoading />}>
        {page}
      </Suspense>
    </Layout>
  )
}

createRoot(document.getElementById('root')).render(<App />)
