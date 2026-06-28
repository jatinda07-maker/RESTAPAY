import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Restaurant performance overview',
  sales: 'Sales imports, manual sales, and sales history',
  vendors: 'Vendor setup, categories, and spending',
  invoices: 'Invoice upload, AI extraction, and invoice history',
  employees: 'Employee setup, job types, and payroll settings',
  payroll: 'Payroll groups, payroll entries, and payroll history',
  expenses: 'Restaurant expenses, categories, and payment methods',
  reports: 'Standard reports, custom reports, and exports',
  settings: 'Backup, restore, and application settings'
}


export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">R</div>
        <div className="brand-name">Resta<span>Pay</span></div>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map(([key, label]) => <button key={key} onClick={() => setActive(key)} className={`nav-item ${active === key ? 'active' : ''}`}>
          <span className="nav-icon"><Icon name={key} size={20} /></span>
          <span className="nav-label">{label}</span>
        </button>)}
      </nav>
    </aside>
    <main className="main-panel">
      <header className="page-title-strip">
        <div>
          <h1>{title}</h1>
          <p>{subtitles[active] || 'RestaPay workspace'}</p>
        </div>
      </header>
      <section className="content-area">{children}</section>
    </main>
  </div>
}
