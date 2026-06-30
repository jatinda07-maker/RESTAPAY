import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Restaurant intelligence, cash position, and operating performance',
  sales: 'Toast imports, manual sales, tips, and sales history',
  vendors: 'Vendor setup, categories, payment terms, and spending',
  invoices: 'Invoice capture, AI extraction, line items, and spend history',
  employees: 'Employee profiles, job types, pay methods, and assignments',
  payroll: 'Payroll groups, cash/check payroll, server tips, and pay history',
  expenses: 'Business expenses, categories, cash/check payments, and tracking',
  reports: 'Standard reports, custom reports, exports, and weekly summaries',
  settings: 'Backup, restore, restaurant setup, and application preferences'
}

export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'
  return <div className="rp-shell">
    <aside className="rp-sidebar" aria-label="RestaPay navigation">
      <div className="rp-brand">
        <div className="rp-brand-mark">R</div>
        <div className="rp-brand-copy">
          <b>RestaPay</b>
          <span>Restaurant Office</span>
        </div>
      </div>
      <nav className="rp-nav-list" aria-label="Primary navigation">
        {navItems.map(([key, label]) => <button key={key} type="button" onClick={() => setActive(key)} className={`rp-nav-item ${active === key ? 'active' : ''}`} title={label}>
          <span className="rp-nav-icon"><Icon name={key} size={19} /></span>
          <span className="rp-nav-label">{label}</span>
        </button>)}
      </nav>
      <div className="rp-sidebar-footer">
        <div className="rp-status-dot" />
        <div>
          <b>Live Workspace</b>
          <span>Local + Supabase ready</span>
        </div>
      </div>
    </aside>
    <main className="rp-main-panel">
      <header className="rp-topbar">
        <div>
          <h1>{title}</h1>
          <p>{subtitles[active] || 'RestaPay workspace'}</p>
        </div>
        <div className="rp-topbar-actions">
          <span className="rp-chip">RC5 Clean UI</span>
          <span className="rp-chip orange">No old CSS</span>
        </div>
      </header>
      <section className="rp-content-area">{children}</section>
    </main>
  </div>
}
