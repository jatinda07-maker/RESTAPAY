import React, { useMemo, useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const pageCopy = {
  dashboard: ['Dashboard', 'Business Overview & Performance'],
  sales: ['Sales', 'Toast sales import, payment breakdowns, and sales history'],
  vendors: ['Vendors', 'Vendor profiles, categories, and purchase intelligence'],
  invoices: ['Invoices', 'Invoice entry, vendor spend, and line-item tracking'],
  employees: ['Employees', 'Employee setup, roles, assignments, and pay types'],
  payroll: ['Payroll', 'Cash payroll, check payroll, tips, and labor history'],
  expenses: ['Expenses', 'Restaurant expenses, categories, and payments'],
  reports: ['Reports', 'Executive reports, exports, and weekly analysis'],
  'price-increase': ['Price Increase', 'Vendor price changes and margin impact'],
  settings: ['Settings', 'Restaurant setup, backups, sync, and preferences']
}

function labelFor(key) {
  return navItems.find(([id]) => id === key)?.[1] || key
}

export default function Layout({ active, setActive, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [title, subtitle] = useMemo(() => pageCopy[active] || [labelFor(active), 'Restaurant office workspace'], [active])

  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="brand-block">
        <div className="brand-icon"><Icon name="utensils" size={25} /></div>
        <div className="brand-text"><strong>Resta<span>Pay</span></strong><small>Restaurant Intelligence</small></div>
      </div>

      <nav className="main-nav">
        {navItems.map(([key, label]) => <button key={key} type="button" title={label} onClick={() => setActive(key)} className={`nav-button ${active === key ? 'active' : ''}`}>
          <span className="nav-icon"><Icon name={key} size={20} /></span>
          <span className="nav-label">{label}</span>
        </button>)}
        <button type="button" title="Restaurant Health" className={`nav-button ${active === 'restaurant-health' ? 'active' : ''}`} onClick={() => setActive('dashboard')}>
          <span className="nav-icon"><Icon name="shield" size={20} /></span>
          <span className="nav-label">Restaurant Health</span>
        </button>
      </nav>

      <div className="sidebar-meta">
        <div className="sidebar-card restaurant-card">
          <span className="mini-app-icon"><Icon name="store" size={18} /></span>
          <div><b>Restapay Restaurant</b><small>Business</small></div>
        </div>
        <div className="sidebar-card user-card">
          <span className="avatar">JP</span>
          <div><b>Jatin Patel</b><small>Admin</small></div>
        </div>
        <div className="sidebar-card support-card">
          <span className="mini-app-icon muted"><Icon name="bell" size={18} /></span>
          <div><b>Need Help?</b><small>Contact Support</small></div>
        </div>
      </div>

      <button className="collapse-control" type="button" onClick={() => setCollapsed(value => !value)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        <Icon name="menu" size={18} /><span>{collapsed ? 'Expand' : 'Collapse'}</span>
      </button>
    </aside>

    <main className="app-main">
      <header className="app-header">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="header-actions">
          <button className="btn soft"><Icon name="upload" size={18} />Import Sales</button>
          <button className="btn soft"><Icon name="invoices" size={18} />Add Invoice</button>
          <button className="btn accent"><Icon name="plus" size={18} />Add Expense</button>
        </div>
      </header>
      <section className="page-content">{children}</section>
    </main>
  </div>
}
