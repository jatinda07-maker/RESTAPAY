import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3, Building2, CalendarRange, Cloud, FileText, Gauge, Landmark,
  LayoutDashboard, PackageSearch, ReceiptText, Settings, TrendingUp,
  Users, WalletCards, Wine
} from 'lucide-react'

const sections = [
  {
    label: 'OVERVIEW',
    items: [
      ['/dashboard', 'Dashboard', LayoutDashboard],
      ['/sales', 'Sales', BarChart3],
    ],
  },
  {
    label: 'PURCHASING',
    items: [
      ['/food-alcohol-cost', 'Food & Alcohol Cost', Wine],
      ['/invoices', 'Invoices', FileText],
      ['/vendors', 'Vendors', Building2],
      ['/vendor-comparison', 'Vendor Comparison', PackageSearch],
      ['/price-increase', 'Price Increase', TrendingUp],
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      ['/employees', 'Employees', Users],
      ['/payroll', 'Payroll', WalletCards],
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      ['/expenses', 'Expenses', ReceiptText],
      ['/reports', 'Reports', Gauge],
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      ['/import-center', 'Import Center', CalendarRange],
      ['/toast-integration', 'Toast Integration', Cloud],
      ['/bank-checks', 'Bank & Checks', Landmark],
      ['/settings', 'Settings', Settings],
    ],
  },
]

export default function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const [collapseLock, setCollapseLock] = useState(false)

  const handleMouseEnter = () => {
    if (!collapseLock) setExpanded(true)
  }

  const handleMouseLeave = () => {
    setExpanded(false)
    setCollapseLock(false)
  }

  const handleNavigate = (event) => {
    event.currentTarget.blur()
    setExpanded(false)
    setCollapseLock(true)
  }

  return (
    <aside
      className={`sidebar${expanded ? ' is-expanded' : ''}`}
      aria-label="Main navigation"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="brand">
        <div className="brand-mark">R</div>
        <div className="brand-name">RestaPay</div>
      </div>
      <nav className="sidebar-nav">
        {sections.map((section) => (
          <div className="nav-section" key={section.label}>
            <div className="nav-section-label">{section.label}</div>
            {section.items.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                onClick={handleNavigate}
              >
                <Icon className="nav-icon" size={20} strokeWidth={1.9} />
                <span className="nav-label">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}
