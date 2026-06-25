import React, { useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const dateAwarePages = new Set(['dashboard', 'payroll', 'reports'])
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

function todayISO() { return new Date().toISOString().slice(0, 10) }
function weekStartISO() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

export default function Layout({ active, setActive, children }) {
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'
  const [dateRange, setDateRange] = useState(() => {
    try { return JSON.parse(localStorage.getItem('restapayDateRange') || 'null') || { start: weekStartISO(), end: todayISO() } } catch { return { start: weekStartISO(), end: todayISO() } }
  })
  const showDate = dateAwarePages.has(active)
  function updateRange(next) {
    const fixed = { ...dateRange, ...next }
    setDateRange(fixed)
    localStorage.setItem('restapayDateRange', JSON.stringify(fixed))
    window.dispatchEvent(new CustomEvent('restapay-date-range-change', { detail: fixed }))
  }
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
        {showDate ? <div className="strip-date-range" aria-label="Date range filter">
          <Icon name="calendar" size={17} />
          <input type="date" value={dateRange.start} onChange={event => updateRange({ start: event.target.value })} />
          <span>to</span>
          <input type="date" value={dateRange.end} onChange={event => updateRange({ end: event.target.value })} />
        </div> : null}
      </header>
      <section className="content-area">{children}</section>
    </main>
  </div>
}
