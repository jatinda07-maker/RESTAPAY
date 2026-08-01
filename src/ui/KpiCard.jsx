import React from 'react'
import { Icon } from '../components/Icons'

export default function KpiCard({ title, value, subtitle, icon, tone = 'blue', onClick, compact = false }) {
  const Element = onClick ? 'button' : 'article'
  const props = onClick ? { type: 'button', onClick } : {}
  return (
    <Element className={`ui-kpi-card ui-tone-${tone}${compact ? ' is-compact' : ''}`} {...props}>
      <span className="ui-kpi-icon" aria-hidden="true"><Icon name={icon} size={21} /></span>
      <span className="ui-kpi-copy">
        <span className="ui-kpi-title">{title}</span>
        <strong className="ui-kpi-value">{value}</strong>
        {subtitle ? <small className="ui-kpi-subtitle">{subtitle}</small> : null}
      </span>
      {onClick ? <span className="ui-kpi-chevron" aria-hidden="true"><Icon name="chevronRight" size={18} /></span> : null}
    </Element>
  )
}
