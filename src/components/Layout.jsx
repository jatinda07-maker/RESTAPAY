import React, { useEffect, useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'
import { RESTAPAY_CLOUD_STATUS_EVENT } from '../lib/localStore'
import { isSupabaseReady } from '../lib/supabase'

const navSections = [
  { label: 'Overview', keys: ['dashboard', 'sales', 'cost-analysis'] },
  { label: 'Purchasing', keys: ['invoices', 'vendors', 'vendor-comparison', 'price-increase'] },
  { label: 'People', keys: ['employees', 'payroll', 'approved-payroll'] },
  { label: 'Operations', keys: ['expenses', 'reports'] },
  { label: 'Menu & Toast', keys: ['menu-intelligence', 'menu-costing', 'import-center', 'toast-integration'] },
  { label: 'System', keys: ['diagnostics', 'settings'] }
]

const subtitles = {
  dashboard: 'Overview of your restaurant business',
  'cost-analysis': 'Detailed food and alcohol sales, cost allocation, and profitability',
  'import-center': 'Upload Toast sales, labor, Product Mix, invoices, rebates, and backups from one workspace',
  'toast-integration': 'Monitor automatic Toast SFTP exports and daily Supabase imports',
  sales: 'Manage Toast imports, daily sales, payment methods, and sales history',
  'menu-intelligence': 'Most sold, least sold, plate cost, ingredient cost, and menu profitability',
  'menu-costing': 'Import Product Mix, estimate recipes, and calculate dish profit',
  vendors: 'Manage vendors, categories, payment terms, and contacts',
  'vendor-comparison': 'Compare invoice item prices, package sizes, unit costs, and vendor savings',
  invoices: 'Upload invoices, review totals, and organize vendor bills',
  employees: 'Manage employees, roles, pay types, and status',
  payroll: 'Process payroll groups, manual payroll, tips, and history',
  'approved-payroll': 'Review approved payroll, payment amounts, methods, check numbers, and status',
  expenses: 'Track restaurant expenses, payment methods, and categories',
  reports: 'Generate weekly reports, exports, and custom business analysis',
  'price-increase': 'Review vendor item increases and pricing risk',
  diagnostics: 'Review database sync, imports, errors, warnings, and downloadable support logs',
  settings: 'Manage business info, categories, backup, and app settings'
}

export default function Layout({ active, setActive, children }) {
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'
  const sidebarOpen = isHoveringSidebar || mobileNavOpen
  const [cloudStatus, setCloudStatus] = useState(() => {
    try { return JSON.parse(localStorage.getItem('restapay_cloud_status') || '{}') } catch { return {} }
  })

  useEffect(() => {
    if (isSupabaseReady && (!cloudStatus.status || cloudStatus.status === 'offline' || cloudStatus.status === 'local')) {
      const connected = { status: 'saved', message: 'Cloud connection ready', at: new Date().toISOString() }
      setCloudStatus(connected)
      try { localStorage.setItem('restapay_cloud_status', JSON.stringify(connected)) } catch {}
    }
    function handler(event) { setCloudStatus(event.detail || {}) }
    window.addEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handler)
    return () => window.removeEventListener(RESTAPAY_CLOUD_STATUS_EVENT, handler)
  }, [])

  function handleNavPress(key) {
    setActive(key)
    setIsHoveringSidebar(false)
    setMobileNavOpen(false)
  }

  function toggleMobileNav() {
    setMobileNavOpen(open => !open)
  }

  function closeMobileNav() {
    setMobileNavOpen(false)
  }

  const cloudLabel = cloudStatus.status === 'saving'
    ? 'Saving...'
    : cloudStatus.status === 'offline' && String(cloudStatus.message || '').toLowerCase().includes('not configured')
      ? 'Cloud Setup Needed'
      : cloudStatus.status === 'offline'
        ? 'Offline Backup'
        : cloudStatus.status === 'local'
          ? 'Local Backup'
          : 'Cloud Saved'

  return (
    <div className={`app-shell is-collapsed ${sidebarOpen ? 'sidebar-open' : ''} ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
      <button type="button" className="mobile-nav-backdrop" aria-label="Close navigation" onClick={closeMobileNav} />
      <aside
        className="sidebar"
        aria-label="RestaPay navigation"
        onMouseEnter={() => setIsHoveringSidebar(true)}
        onMouseLeave={() => setIsHoveringSidebar(false)}
      >
        <div className="brand-row">
          <div className="brand-mark">R</div>
          <div className="brand-copy">
            <strong>Resta<span>Pay</span></strong>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navSections.map(section => (
            <div className="nav-section" key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.keys.map(key => {
                const item = navItems.find(([itemKey]) => itemKey === key)
                if (!item) return null
                const label = item[1]
                return (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => handleNavPress(key)}
                    className={`nav-item ${active === key ? 'active' : ''}`}
                  >
                    <span className="nav-icon"><Icon name={key} size={20} /></span>
                    <span className="nav-label">{label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button type="button" className="top-menu mobile-menu-button" aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'} onClick={toggleMobileNav}>
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-title-block">
            <h1>{title}</h1>
            <p>{subtitles[active] || 'Restaurant management workspace'}</p>
          </div>
          <div className="topbar-actions">
            <div className={`cloud-pill ${cloudStatus.status || 'saved'}`} title={cloudStatus.message || 'Direct database save'}>
              <span className="cloud-dot" />
              <strong>{cloudLabel}</strong>
            </div>
            <button type="button" className="icon-btn notification-btn" aria-label="Notifications">
              <Icon name="bell" size={21} />
              <span>3</span>
            </button>
            <div className="profile-pill">
              <div className="profile-avatar">JP</div>
              <div>
                <strong>Jatin Patel</strong>
                <small>Admin</small>
              </div>
              <Icon name="chevronDown" size={16} />
            </div>
          </div>
        </header>
        <section className="content-area">{children}</section>
      </main>
    </div>
  )
}
