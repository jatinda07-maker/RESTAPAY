import React from 'react'
import { navItems } from '../data/mockData'
import { Icon } from './Icons'

export default function Layout({ active, setActive, children }) {
  return <div className="app-shell v3-shell">
    <aside className="sidebar v3-sidebar" aria-label="RestaPay navigation">
      <div className="brand v3-brand">
        <div className="brand-mark">R</div>
        <div className="brand-name">Resta<span>Pay</span></div>
      </div>
      <nav className="nav-list" aria-label="Primary navigation">
        {navItems.map(([key, label]) => <button
          key={key}
          type="button"
          onClick={() => setActive(key)}
          className={`nav-item ${active === key ? 'active' : ''}`}
          title={label}
          aria-label={label}
        >
          <span className="nav-icon"><Icon name={key} size={20} /></span>
          <span className="nav-label">{label}</span>
        </button>)}
      </nav>
    </aside>
    <main className="main-panel v3-main">
      <section className="content-area v3-content">{children}</section>
    </main>
  </div>
}
