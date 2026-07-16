import React, { useEffect } from 'react'

export function SummaryCards({ cards = [], activeKey = '', onSelect }) {
  return (
    <div className="payroll-summary-row sales-summary-row clickable-summary-row">
      {cards.map(card => (
        <button
          key={card.key}
          type="button"
          className={`summary-click-card ${card.tone ? `tone-${card.tone}` : ''} ${activeKey === card.key ? 'active' : ''}`}
          onClick={() => onSelect?.(activeKey === card.key ? '' : card.key)}
          aria-expanded={activeKey === card.key}
        >
          <span>{card.label}</span>
          <b>{card.value}</b>
          {card.note ? <small>{card.note}</small> : null}
        </button>
      ))}
    </div>
  )
}

export function DrilldownPanel({ title, rows = [], columns = [], totalLabel = 'Total', total = '', onClose, empty = 'No matching details in the selected range.', id = 'summary-details' }) {
  useEffect(() => {
    if (!title) return
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 0)
    return () => clearTimeout(timer)
  }, [title, id])

  if (!title) return null
  return (
    <section className="table-card compact-table-card summary-drilldown" id={id}>
      <header className="table-header-actions">
        <div><h2>{title}</h2><span>{rows.length} matching rows</span></div>
        <button type="button" className="btn ghost small-btn" onClick={onClose}>Close Details</button>
      </header>
      <div className="table-scroll">
        <table>
          <thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || `${title}-${index}`}>
                {columns.map(col => <td key={col.key}>{col.render ? col.render(row) : String(row[col.key] ?? '-')}</td>)}
              </tr>
            )) : <tr><td colSpan={Math.max(columns.length, 1)}><small>{empty}</small></td></tr>}
          </tbody>
          {rows.length && total !== '' ? <tfoot><tr><th colSpan={Math.max(columns.length - 1, 1)}>{totalLabel}</th><th>{total}</th></tr></tfoot> : null}
        </table>
      </div>
    </section>
  )
}
