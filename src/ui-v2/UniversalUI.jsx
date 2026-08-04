import React from 'react'
import { Icon } from '../components/Icons'

export function UiButton({ variant = 'secondary', icon, className = '', children, ...props }) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`.trim()} type="button" {...props}>
      {icon ? <Icon name={icon} size={17} /> : null}
      <span>{children}</span>
    </button>
  )
}

export function UiIconButton({ icon, label, variant = 'secondary', className = '', ...props }) {
  return (
    <button className={`ui-icon-button ui-icon-button-${variant} ${className}`.trim()} type="button" aria-label={label} title={label} {...props}>
      <Icon name={icon} size={17} />
    </button>
  )
}

export function UiField({ label, hint, className = '', children }) {
  return (
    <label className={`ui-field ${className}`.trim()}>
      {label ? <span className="ui-field-label">{label}</span> : null}
      {children}
      {hint ? <small className="ui-field-hint">{hint}</small> : null}
    </label>
  )
}

export function UiInput({ className = '', ...props }) {
  return <input className={`ui-control ${className}`.trim()} {...props} />
}

export function UiSelect({ className = '', children, ...props }) {
  return <select className={`ui-control ui-select ${className}`.trim()} {...props}>{children}</select>
}

export function UiSearch({ className = '', ...props }) {
  return (
    <span className={`ui-search ${className}`.trim()}>
      <Icon name="search" size={17} />
      <input type="search" {...props} />
    </span>
  )
}

export function UiPageActions({ children, className = '' }) {
  return <div className={`ui-page-actions ${className}`.trim()}>{children}</div>
}

export function UiToolbar({ children, className = '' }) {
  return <div className={`ui-toolbar ${className}`.trim()}>{children}</div>
}

export function UiDateRange({ preset, onPresetChange, from, onFromChange, to, onToChange, onApply, applyLabel = 'Apply' }) {
  return (
    <div className="ui-date-range">
      <UiField label="Date Range">
        <UiSelect value={preset} onChange={onPresetChange}>
          <option value="custom">Custom Range</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </UiSelect>
      </UiField>
      <UiField label="From"><UiInput type="date" value={from} onChange={onFromChange} /></UiField>
      <span className="ui-date-arrow" aria-hidden="true">→</span>
      <UiField label="To"><UiInput type="date" value={to} onChange={onToChange} /></UiField>
      <UiButton variant="primary" icon="calendar" onClick={onApply}>{applyLabel}</UiButton>
    </div>
  )
}

export function UiUploadBar({ label, accept, onChange, action, className = '' }) {
  return (
    <div className={`ui-upload-bar ${className}`.trim()}>
      <span className="ui-upload-label"><Icon name="upload" size={18} /><strong>{label}</strong></span>
      <label className="ui-file-picker">
        <span>Choose File</span>
        <input type="file" accept={accept} onChange={onChange} />
      </label>
      <span className="ui-file-name">No file chosen</span>
      {action ? <div className="ui-upload-action">{action}</div> : null}
    </div>
  )
}

export function UiKpiCard({ tone = 'blue', icon, label, value, meta, trend, onClick, className = '' }) {
  const Tag = onClick ? 'button' : 'article'
  return (
    <Tag className={`ui-kpi ui-tone-${tone} ${onClick ? 'is-clickable' : ''} ${className}`.trim()} type={onClick ? 'button' : undefined} onClick={onClick}>
      <span className="ui-kpi-icon"><Icon name={icon} size={19} /></span>
      <span className="ui-kpi-copy">
        <span className="ui-kpi-label">{label}</span>
        <strong>{value}</strong>
        {trend ? <small className="ui-kpi-trend">{trend}</small> : null}
        {meta ? <em>{meta}</em> : null}
      </span>
      {onClick ? <span className="ui-kpi-arrow">›</span> : null}
    </Tag>
  )
}

export function UiKpiGrid({ children, columns = 4, className = '' }) {
  return <div className={`ui-kpi-grid ${className}`.trim()} style={{ '--ui-kpi-columns': columns }}>{children}</div>
}

export function UiPanel({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`ui-panel ${className}`.trim()}>
      {(title || actions) ? (
        <header className="ui-panel-header">
          <div>{title ? <h2>{title}</h2> : null}{subtitle ? <p>{subtitle}</p> : null}</div>
          {actions ? <div className="ui-panel-actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="ui-panel-body">{children}</div>
    </section>
  )
}

export function UiTabs({ tabs, active, onChange, className = '' }) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist">
      {tabs.map(tab => (
        <button key={tab.value} type="button" role="tab" aria-selected={active === tab.value} className={active === tab.value ? 'is-active' : ''} onClick={() => onChange(tab.value)}>
          {tab.icon ? <Icon name={tab.icon} size={16} /> : null}<span>{tab.label}</span>
        </button>
      ))}
    </div>
  )
}

export function UiTableShell({ toolbar, children, footer, className = '' }) {
  return (
    <section className={`ui-table-shell ${className}`.trim()}>
      {toolbar ? <div className="ui-table-toolbar">{toolbar}</div> : null}
      <div className="ui-table-scroll">{children}</div>
      {footer ? <footer className="ui-table-footer">{footer}</footer> : null}
    </section>
  )
}

export function UiStatus({ tone = 'neutral', children }) {
  return <span className={`ui-status ui-status-${tone}`}>{children}</span>
}

export function UiModal({ open, title, subtitle, icon = 'plus', onClose, footer, children, size = 'md' }) {
  if (!open) return null
  return (
    <div className="ui-modal-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className={`ui-modal ui-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-modal-header">
          <span className="ui-modal-icon"><Icon name={icon} size={19} /></span>
          <div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>
          <UiIconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer className="ui-modal-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
