import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Real-time overview of your restaurant performance',
  sales: 'Sales imports, manual sales, and sales history',
  vendors: 'Vendor setup, categories, and spending intelligence',
  invoices: 'Invoice upload, AI extraction, and invoice history',
  employees: 'Employee setup, job types, and payroll settings',
  payroll: 'Payroll groups, payroll entries, tips, and labor history',
  expenses: 'Restaurant expenses, categories, and payments',
  reports: 'Standard reports, custom reports, and exports',
  settings: 'Backup, restore, and application settings',
  'price-increase': 'Vendor price increase intelligence and review'
}

const secondaryItems = [
  ['restaurant-intelligence', 'Restaurant Intelligence', 'shield'],
  ['inventory', 'Inventory (Beta)', 'package'],
  ['budget', 'Budget vs Actual', 'spreadsheet'],
  ['goals', 'Goals & Targets', 'alert'],
  ['alerts', 'Alerts & Tasks', 'bell']
]

export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'

  return <div className="rp-shell">
    <aside className="rp-sidebar" aria-label="RestaPay sidebar">
      <div className="rp-brand">
        <div className="rp-brand-mark"><Icon name="utensils" size={24} /></div>
        <div><strong>Resta<span>Pay</span></strong><small>Restaurant Intelligence</small></div>
      </div>

      <nav className="rp-nav" aria-label="Primary navigation">
        {navItems.map(([key, label]) => <button key={key} onClick={() => setActive(key)} className={`rp-nav-item ${active === key ? 'active' : ''}`}>
          <Icon name={key} size={19} />
          <span>{label === 'Vendors' ? 'Vendors & Invoices' : label}</span>
        </button>)}
      </nav>

      <div className="rp-nav-section">Modules</div>
      <nav className="rp-nav rp-nav-secondary" aria-label="Secondary modules">
        {secondaryItems.map(([key, label, icon]) => <button key={key} type="button" className="rp-nav-item" onClick={() => setActive(active)}>
          <Icon name={icon} size={18} />
          <span>{label}</span>
        </button>)}
      </nav>

      <div className="rp-sidebar-cards">
        <div className="rp-side-card">
          <div className="rp-side-card-title">Cash Position</div>
          <strong>$3,512.26</strong>
          <span>Cash remaining</span>
          <div className="rp-side-progress"><i /></div>
        </div>
        <div className="rp-side-card">
          <div className="rp-side-card-title">Data & Sync</div>
          <strong>Connected</strong>
          <span>Cloud sync active</span>
        </div>
      </div>
    </aside>

    <main className="rp-main">
      <header className="rp-topbar">
        <div>
          <h1>{title}</h1>
          <p>{subtitles[active] || 'RestaPay workspace'}</p>
        </div>
      </header>
      <section className="rp-content">{children}</section>
    </main>
  </div>
}
