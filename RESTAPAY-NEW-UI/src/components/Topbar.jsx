import { Bell, ChevronDown } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const pageMeta = {
  '/dashboard': ['Dashboard', 'Executive overview of your restaurant business'],
  '/sales': ['Sales', 'Manage Toast imports, daily sales, payment methods, and sales history'],
  '/food-alcohol-cost': ['Food & Alcohol Cost', 'Track food and alcohol costs by department'],
  '/invoices': ['Invoices', 'Upload invoices, review totals, and organize vendor bills'],
  '/vendors': ['Vendors', 'Manage vendors, categories, contacts, and payment terms'],
  '/vendor-comparison': ['Vendor Comparison', 'Compare invoice item prices, package sizes, and vendor savings'],
  '/price-increase': ['Price Increase', 'Review vendor item increases and pricing risk'],
  '/employees': ['Employees', 'Manage employees, roles, pay types, and status'],
  '/payroll': ['Payroll', 'Process payroll groups, manual payroll, tips, and history'],
  '/expenses': ['Expenses', 'Track restaurant expenses, payment methods, and categories'],
  '/reports': ['Reports', 'Generate weekly reports, exports, and business analysis'],
  '/import-center': ['Import Center', 'Upload and organize restaurant business data'],
  '/toast-integration': ['Toast Integration', 'Monitor automatic Toast exports and imports'],
  '/bank-checks': ['Bank & Checks', 'Reconcile bank checks and business documents'],
  '/settings': ['Settings', 'Manage account and application preferences'],
}

export default function Topbar() {
  const { pathname } = useLocation()
  const [title, subtitle] = pageMeta[pathname] || ['RestaPay', 'Restaurant business management']

  return (
    <header className="topbar">
      <div className="topbar-page-title">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="topbar-actions">
        <div className="save-pill"><span className="status-dot" />Not Saved</div>
        <button className="icon-button notification-button" type="button" aria-label="Notifications">
          <Bell size={19} />
          <span className="notification-badge">3</span>
        </button>
        <div className="avatar">JP</div>
        <div className="user-copy">
          <strong>Jatin Patel</strong>
          <span>Admin</span>
        </div>
        <ChevronDown size={16} />
      </div>
    </header>
  )
}
