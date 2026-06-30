import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Restaurant intelligence, sales health, cash position, and operating performance',
  sales: 'Toast sales imports, payment mix, manual sales, and sales history',
  vendors: 'Vendor directory, categories, payment details, and spending controls',
  invoices: 'Invoice capture, AI extraction, vendor spending, and invoice history',
  employees: 'Employee setup, job types, pay settings, and staffing controls',
  payroll: 'Payroll groups, cash/check payroll, tips, and labor tracking',
  expenses: 'Business expenses, categories, payment methods, and operating costs',
  reports: 'Executive reports, weekly scorecards, custom reports, and exports',
  'price-increase': 'Vendor price changes, margin pressure, and savings opportunities',
  settings: 'Application settings, backup, restore, and configuration'
}

function getInitials(label = 'RestaPay') {
  return String(label).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'RP'
}

export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'Dashboard'
  const dateText = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return <div className="app-shell v3-shell">
    <aside className="sidebar v3-sidebar" aria-label="RestaPay navigation">
      <div className="brand v3-brand">
        <div className="brand-mark v3-brand-mark">R</div>
        <div className="brand-copy">
          <div className="brand-name">Resta<span>Pay</span></div>
          <small>Enterprise</small>
        </div>
      </div>

      <div className="restaurant-switcher">
        <div className="restaurant-avatar">RP</div>
        <div className="restaurant-copy">
          <strong>Restaurant</strong>
          <small>Active workspace</small>
        </div>
      </div>

      <nav className="nav-list v3-nav" aria-label="Primary navigation">
        {navItems.map(([key, label]) => <button
          key={key}
          type="button"
          title={label}
          onClick={() => setActive(key)}
          className={`nav-item v3-nav-item ${active === key ? 'active' : ''}`}
        >
          <span className="nav-icon"><Icon name={key} size={19} /></span>
          <span className="nav-label">{label}</span>
        </button>)}
      </nav>

      <div className="sidebar-footer">
        <div className="user-chip">
          <span>{getInitials('Admin User')}</span>
          <div>
            <strong>Admin</strong>
            <small>Owner mode</small>
          </div>
        </div>
      </div>
    </aside>

    <main className="main-panel v3-main">
      <header className="page-title-strip v3-topbar">
        <div className="topbar-title">
          <span className="eyebrow">RestaPay Workspace</span>
          <h1>{title}</h1>
          <p>{subtitles[active] || 'Restaurant management workspace'}</p>
        </div>
        <div className="topbar-actions">
          <div className="topbar-date"><Icon name="calendar" size={16} /><span>{dateText}</span></div>
          <button type="button" className="btn solid secondary"><Icon name="bell" size={16} /> Alerts</button>
          <button type="button" className="btn solid primary" onClick={() => setActive('sales')}><Icon name="upload" size={16} /> Import</button>
        </div>
      </header>
      <section className="content-area v3-content">{children}</section>
    </main>
  </div>
}
