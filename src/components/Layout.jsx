import React, { useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Overview of your restaurant business',
  sales: 'Manage Toast imports, daily sales, payment methods, and sales history',
  vendors: 'Manage vendors, categories, payment terms, and contacts',
  invoices: 'Upload invoices, review totals, and organize vendor bills',
  employees: 'Manage employees, roles, pay types, and status',
  payroll: 'Process payroll groups, manual payroll, tips, and history',
  expenses: 'Track restaurant expenses, payment methods, and categories',
  'ai-import-center': 'AI-powered review center for Toast, invoices, statements, checks, and rules',
  'bank-statements': 'AI Check Processing: read check data, review, approve, and import selected expenses',
  'ai-rules': 'Manage learned payee, vendor, employee, and category rules',
  reports: 'Generate weekly reports, exports, and custom business analysis',
  'price-increase': 'Review vendor item increases and pricing risk',
  settings: 'Manage business info, categories, backup, and app settings'
}

export default function Layout({ active, setActive, children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('restapay_sidebar_collapsed') !== 'false')
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'

  return (
    <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="RestaPay navigation">
        <div className="brand-row">
          <div className="brand-mark">R</div>
          <div className="brand-copy">
            <strong>Resta<span>Pay</span></strong>
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
              <span className="nav-icon"><Icon name={key} size={20} /></span>
              <span className="nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <button
          type="button"
          className="collapse-control"
          onClick={() => setCollapsed(value => { const next = !value; localStorage.setItem('restapay_sidebar_collapsed', String(next)); return next })}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={19} />
          <span>{collapsed ? 'Expand' : 'Collapse'}</span>
        </button>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button type="button" className="top-menu" onClick={() => setCollapsed(value => { const next = !value; localStorage.setItem('restapay_sidebar_collapsed', String(next)); return next })} aria-label="Toggle navigation">
            <Icon name="menu" size={22} />
          </button>
          <div className="topbar-title-block">
            <h1>{title}</h1>
            <p>{subtitles[active] || 'Restaurant management workspace'}</p>
          </div>
          <div className="topbar-actions">
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
