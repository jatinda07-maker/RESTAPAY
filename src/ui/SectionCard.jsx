import React from 'react'
import { Icon } from '../components/Icons'

export default function SectionCard({ title, icon, tone = 'blue', total, subtitle, action, onOpen, children, className = '' }) {
  return (
    <section className={`ui-section-card ui-tone-${tone} ${className}`.trim()}>
      <header className="ui-section-header">
        <button type="button" className="ui-section-title" onClick={onOpen} disabled={!onOpen} aria-label={onOpen ? `Open ${title} details` : undefined}>
          <span className="ui-section-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
          <span className="ui-section-heading">
            <strong>{title}</strong>
            {subtitle ? <small>{subtitle}</small> : null}
          </span>
          {total ? <span className="ui-section-total">{total}</span> : null}
          {onOpen ? <Icon name="chevronRight" size={18} /> : null}
        </button>
        {action ? <div className="ui-section-action">{action}</div> : null}
      </header>
      <div className="ui-section-body">{children}</div>
    </section>
  )
}
