import React, { useState } from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

const subtitles = {
  dashboard: 'Overview of your restaurant business',
  sales: 'Manage Toast imports, daily sales, payment methods, and sales history',
  'menu-costing': 'Import Product Mix, estimate recipes, and calculate dish profit',
  vendors: 'Manage vendors, categories, payment terms, and contacts',
  invoices: 'Upload invoices, review totals, and organize vendor bills',
  employees: 'Manage employees, roles, pay types, and status',
  payroll: 'Process payroll groups, manual payroll, tips, and history',
  expenses: 'Track restaurant expenses, payment methods, and categories',
  reports: 'Generate weekly reports, exports, and custom business analysis',
  'price-increase': 'Review vendor item increases and pricing risk',
  settings: 'Manage business info, categories, backup, and app settings'
}

export default function Layout({ active, setActive, children }) {
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)
  const activeItem = navItems.find(([key]) => key === active)
  const title = activeItem?.[1] || 'RestaPay'
  const sidebarOpen = isHoveringSidebar

  function handleNavPress(key) {
    setActive(key)
    setIsHoveringSidebar(false)
  }

  return (
    <div className={`app-shell is-collapsed ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
          {navItems.map(([key, label]) => (
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
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="top-menu auto-sidebar-indicator" title="Navigation opens when you hover the left side"><Icon name="menu" size={22} /></div>
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
