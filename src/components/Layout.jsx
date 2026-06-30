import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Restaurant intelligence, cash position, and operating performance',
  sales: 'Toast imports, manual sales, payment mix, and sales history',
  vendors: 'Vendor setup, categories, payment details, and spending control',
  invoices: 'Invoice upload, AI extraction, line items, and vendor totals',
  employees: 'Employee setup, job types, payroll method, and employee records',
  payroll: 'Payroll groups, labor imports, tips, checks, cash, and payroll history',
  expenses: 'Restaurant operating expenses, payment method, checks, and categories',
  reports: 'Executive reports, weekly summaries, exports, and custom analysis',
  'price-increase': 'Vendor price increases, item tracking, and margin risk',
  settings: 'Backup, restore, Supabase, AI settings, and application controls'
}

export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="RestaPay navigation">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div className="brand-text">
            <strong>RestaPay</strong>
            <span>Enterprise</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map(([key, label]) => (
            <button
              key={key}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => setActive(key)}
              className={`nav-item ${active === key ? 'active' : ''}`}
            >
              <span className="nav-icon"><Icon name={key} size={19} /></span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-dot">JP</div>
          <div className="sidebar-user-copy">
            <strong>Jatin</strong>
            <span>Owner workspace</span>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <span className="eyebrow">RestaPay Workspace</span>
            <h1>{title}</h1>
            <p>{subtitles[active] || 'Restaurant management workspace'}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="btn secondary compact"><Icon name="bell" size={16} /> Alerts</button>
            <button type="button" className="btn primary compact" onClick={() => setActive('sales')}><Icon name="upload" size={16} /> Import Toast</button>
          </div>
        </header>
        <section className="content-area">{children}</section>
      </main>
    </div>
  )
}
