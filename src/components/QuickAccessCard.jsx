import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CloudDownload,
  FileSpreadsheet,
  ReceiptText,
} from 'lucide-react'

const quickLinks = [
  {
    to: '/import-center',
    icon: FileSpreadsheet,
    title: 'Import Sales',
    subtitle: 'Toast sales summary',
    tone: 'blue',
  },
  {
    to: '/payroll',
    icon: ReceiptText,
    title: 'Import Labor',
    subtitle: 'Toast labor summary',
    tone: 'green',
  },
  {
    to: '/food-alcohol-cost',
    icon: BarChart3,
    title: 'Product Mix',
    subtitle: 'Menu sales analysis',
    tone: 'purple',
  },
  {
    to: '/toast-integration',
    icon: CloudDownload,
    title: 'Toast Sync',
    subtitle: 'Connection and history',
    tone: 'orange',
  },
]

export default function QuickAccessCard() {
  return (
    <section className="quick-access-card card-surface">
      <div className="quick-access-header">
        <div>
          <h3>Quick Access</h3>
          <span>Common import and Toast tools</span>
        </div>
      </div>

      <div className="quick-access-grid">
        {quickLinks.map(({ to, icon: Icon, title, subtitle, tone }) => (
          <Link className={`quick-access-link quick-${tone}`} to={to} key={title}>
            <span className="quick-access-icon"><Icon size={19} strokeWidth={2} /></span>
            <span className="quick-access-copy">
              <strong>{title}</strong>
              <small>{subtitle}</small>
            </span>
            <ArrowRight className="quick-access-arrow" size={16} strokeWidth={2.2} />
          </Link>
        ))}
      </div>
    </section>
  )
}
