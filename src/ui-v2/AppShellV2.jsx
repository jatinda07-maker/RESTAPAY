import React, { useEffect, useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from '../components/Icons'
import { RESTAPAY_CLOUD_STATUS_EVENT } from '../lib/localStore'
import { isSupabaseReady } from '../lib/supabase'

const navSections = [
  { label: 'Overview', keys: ['dashboard', 'sales', 'cost-analysis'] },
  { label: 'Purchasing', keys: ['invoices', 'vendors', 'vendor-comparison', 'price-increase'] },
  { label: 'People', keys: ['employees', 'payroll'] },
  { label: 'Operations', keys: ['expenses', 'reports'] },
  { label: 'Menu & Toast', keys: ['menu-intelligence', 'menu-costing', 'import-center', 'toast-integration'] },
  { label: 'System', keys: ['diagnostics', 'settings'] }
]

const subtitles = {
  dashboard: 'Executive overview of sales, cash, costs, and restaurant health',
  sales: 'Manage Toast imports, payment methods, and daily sales history',
  'cost-analysis': 'Food and alcohol profitability, allocation, and cost performance',
  invoices: 'Capture, review, and organize vendor invoices',
  vendors: 'Manage vendors, categories, contacts, and payment terms',
  'vendor-comparison': 'Compare item prices, package sizes, and vendor savings',
  employees: 'Manage employees, roles, pay types, and status',
  payroll: 'Process payroll groups, manual payroll, tips, and history',
  expenses: 'Track restaurant expenses, payments, and categories',
  reports: 'Generate weekly reports, exports, and business analysis',
  'menu-costing': 'Calculate recipe cost, contribution, and menu margin',
  'menu-intelligence': 'Review best sellers, low performers, and menu profitability',
  'import-center': 'Upload Toast, invoices, rebates, and backup data',
  'toast-integration': 'Monitor automatic Toast exports and Supabase imports',
  diagnostics: 'Review sync, imports, warnings, and support logs',
  settings: 'Manage business, categories, backups, and application settings'
}

export default function AppShellV2({ active, setActive, children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cloudStatus, setCloudStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('restapay_cloud_status') || '{}') } catch { return {} }
  })
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'

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

  const cloudLabel = cloudStatus.status === 'saving' ? 'Saving…'
    : cloudStatus.status === 'offline' ? 'Not Saved'
      : cloudStatus.status === 'local' ? 'Waiting for Cloud'
        : 'Cloud Saved'

  const openPage = key => {
    setActive(key)
    setMobileOpen(false)
  }

  return (
    <div className={`rv2-shell ${mobileOpen ? 'rv2-mobile-open' : ''}`}>
      <button className="rv2-backdrop" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className="rv2-sidebar" aria-label="RestaPay navigation">
        <button className="rv2-brand" type="button" onClick={() => openPage('dashboard')}>
          <span className="rv2-brand-mark">R</span>
          <span className="rv2-brand-word">Resta<span>Pay</span></span>
        </button>
        <nav className="rv2-nav">
          {navSections.map(section => (
            <section className="rv2-nav-section" key={section.label}>
              <div className="rv2-nav-heading">{section.label}</div>
              {section.keys.map(key => {
                const item = navItems.find(([itemKey]) => itemKey === key)
                if (!item) return null
                const label = item[1]
                return (
                  <button
                    key={key}
                    className={`rv2-nav-item ${active === key ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => openPage(key)}
                    title={label}
                  >
                    <span className="rv2-nav-icon"><Icon name={key} size={18} /></span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </section>
          ))}
        </nav>
      </aside>

      <div className="rv2-main">
        <header className="rv2-topbar">
          <button className="rv2-menu" type="button" aria-label="Toggle navigation" onClick={() => setMobileOpen(value => !value)}>
            <Icon name="menu" size={21} />
          </button>
          <div className="rv2-heading-block">
            <h1>{title}</h1>
            <p>{subtitles[active] || 'Restaurant management workspace'}</p>
          </div>
          <div className="rv2-top-actions">
            <div className={`rv2-cloud ${cloudStatus.status || 'saved'}`} title={cloudStatus.message || 'Cloud save status'}>
              <span />
              {cloudLabel}
            </div>
            <button className="rv2-icon-button" type="button" aria-label="Notifications">
              <Icon name="bell" size={19} /><b>3</b>
            </button>
            <div className="rv2-profile">
              <span className="rv2-avatar">JP</span>
              <span><strong>Jatin Patel</strong><small>Admin</small></span>
            </div>
          </div>
        </header>
        <main className="rv2-content">{children}</main>
      </div>
    </div>
  )
}
