import { ChevronRight } from 'lucide-react'

export default function KpiCard({ icon: Icon, title, value, subtitle, tone = 'green', onOpen }) {
  return (
    <button type="button" className={`kpi-card tone-${tone}`} onClick={() => onOpen?.(title)}>
      <div className="kpi-icon"><Icon size={23} strokeWidth={2} /></div>
      <div className="kpi-copy">
        <span className="kpi-title">{title}</span>
        <span className="kpi-subtitle">{subtitle}</span>
        <strong className="kpi-value">{value}</strong>
      </div>
      <ChevronRight className="kpi-arrow" size={19} />
    </button>
  )
}
