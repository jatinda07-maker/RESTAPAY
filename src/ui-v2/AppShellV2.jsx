import React, { useEffect, useMemo, useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from '../components/Icons'
import { RESTAPAY_CLOUD_STATUS_EVENT } from '../lib/localStore'
import { isSupabaseReady } from '../lib/supabase'

const primaryNav = [
  'dashboard', 'sales', 'payroll', 'employees', 'vendors', 'invoices',
  'vendor-comparison', 'expenses', 'price-increase', 'reports',
  'import-center', 'toast-integration', 'settings'
]

const labels = {
  dashboard: 'Dashboard', sales: 'Sales', payroll: 'Payroll', employees: 'Employees',
  vendors: 'Vendors', invoices: 'Invoices', 'vendor-comparison': 'Vendor Comparison',
  expenses: 'Expenses', 'price-increase': 'Price Increase', reports: 'Reports',
  'import-center': 'Bank & Checks', 'toast-integration': 'Toast Integration', settings: 'Settings'
}

const subtitles = {
  dashboard: 'Executive overview of your restaurant business',
  sales: 'Manage Toast imports, daily sales, payment methods, and sales history',
  payroll: 'Process payroll groups, manual payroll, tips, and history',
  employees: 'Manage employees, roles, pay types, and status',
  vendors: 'Manage vendors, categories, contacts, and payment terms',
  invoices: 'Upload invoices, review totals, and organize vendor bills',
  'vendor-comparison': 'Compare invoice item prices, package sizes, unit costs, and vendor savings',
  expenses: 'Track restaurant expenses, payment methods, and categories',
  'price-increase': 'Review vendor item increases and pricing risk',
  reports: 'Generate weekly reports, exports, and business analysis',
  'import-center': 'Reconcile bank checks and import business documents',
  'toast-integration': 'Monitor automatic Toast exports and Supabase imports',
  settings: 'Manage business, categories, backups, and application settings'
}

export default function AppShellV2({ active, setActive, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cloudStatus, setCloudStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('restapay_cloud_status') || '{}') } catch { return {} }
  })

  useEffect(() => {
    if (isSupabaseReady && (!cloudStatus.status || ['offline', 'local'].includes(cloudStatus.status))) {
      const connected = { status: 'saved', message: 'Cloud connection ready', at: new Date().toISOString() }
      setCloudStatus(connected)
      try { localStorage.setItem('restapay_cloud_status', JSON.stringify(connected)) } catch {}
    }
    const handler = event => setCloudStatus(event.detail || {})
    window.addEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handler)
    return () => window.removeEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handler)
  }, [])

  const title = useMemo(() => labels[active] || navItems.find(([key]) => key === active)?.[1] || 'RestaPay', [active])
  const cloudLabel = cloudStatus.status === 'saving' ? 'Saving…' : cloudStatus.status === 'offline' ? 'Not Saved' : cloudStatus.status === 'local' ? 'Waiting for Cloud' : 'Cloud Saved'
  const openPage = key => { setActive(key); setMobileOpen(false) }

  return (
    <div className={`rv2-shell ${mobileOpen ? 'rv2-mobile-open' : ''}`}>
      <button className="rv2-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className="rv2-sidebar" aria-label="RestaPay navigation">
        <button className="rv2-brand" type="button" onClick={() => openPage('dashboard')}>
          <span className="rv2-brand-mark"><span>R</span></span>
          <span className="rv2-brand-copy"><strong>RESTAPAY</strong><small>BACK OFFICE</small></span>
        </button>

        <nav className="rv2-nav">
          {primaryNav.map(key => (
            <button key={key} className={`rv2-nav-item ${active === key ? 'is-active' : ''}`} type="button" onClick={() => openPage(key)}>
              <span className="rv2-nav-icon"><Icon name={key} size={18} /></span>
              <span>{labels[key]}</span>
              {(key === 'payroll' || key === 'reports') && <span className="rv2-nav-chevron"><Icon name="chevronRight" size={15} /></span>}
            </button>
          ))}
        </nav>

        <div className="rv2-sidebar-bottom">
          <div className="rv2-account-label">ACCOUNT</div>
          <button className="rv2-nav-item" type="button"><span className="rv2-nav-icon"><Icon name="employees" size={18} /></span><span>Profile</span></button>
          <button className="rv2-nav-item" type="button"><span className="rv2-nav-icon"><Icon name="logout" size={18} /></span><span>Logout</span></button>
          <button className="rv2-restaurant" type="button">
            <span><small>Current Restaurant</small><strong>Jaybos Restaurant</strong></span><b>⌄</b>
          </button>
        </div>
      </aside>

      <div className="rv2-main">
        <header className={`rv2-topbar ${active === 'dashboard' ? '' : 'rv2-section-topbar'}`}>
          <button className="rv2-menu" type="button" aria-label="Toggle navigation" onClick={() => setMobileOpen(value => !value)}><Icon name="menu" size={20} /></button>
          <div className="rv2-heading-block"><div className="rv2-heading-title"><span className="rv2-heading-icon"><Icon name={active} size={18} /></span><h1>{title}</h1></div><p>{subtitles[active] || 'Restaurant management workspace'}</p></div>
          <div className="rv2-top-actions">
            <div className={`rv2-cloud ${cloudStatus.status || 'saved'}`}><span />{cloudLabel}</div>
            <button className="rv2-icon-button" type="button" aria-label="Notifications"><Icon name="bell" size={19} /><b>3</b></button>
            <div className="rv2-profile"><span className="rv2-avatar">JP</span><span><strong>Jatin Patel</strong><small>Admin</small></span><b>⌄</b></div>
          </div>
        </header>
        <main className={`rv2-content rv2-page-${active}`}>{children}</main>
      </div>
    </div>
  )
}
