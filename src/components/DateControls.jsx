import React, { useMemo, useState } from 'react'
import { Icon } from './Icons'

const OPTIONS = [
  ['today', 'Today'],
  ['lastWeek', 'Last Week'],
  ['lastMonth', 'Last Month'],
  ['thisMonth', 'This Month'],
  ['all', 'All Dates'],
  ['custom', 'Custom Range']
]

export default function DateControls({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  onPreset,
  className = '',
  showLabels = true,
  applyLabel = 'Apply Range'
}) {
  const [quickRange, setQuickRange] = useState('thisMonth')
  const customSelected = useMemo(() => quickRange === 'custom', [quickRange])

  function chooseRange(event) {
    const value = event.target.value
    setQuickRange(value)
    if (value !== 'custom') onPreset?.(value)
  }

  function changeStart(value) {
    setQuickRange('custom')
    onStartChange?.(value)
  }

  function changeEnd(value) {
    setQuickRange('custom')
    onEndChange?.(value)
  }

  return (
    <div className={`date-control-card date-control-professional ${className}`.trim()}>
      <div className="date-control-range">
        <label className="date-range-field">
          <span>{showLabels ? 'Start Date' : ''}</span>
          <input type="date" value={start || ''} onChange={e => changeStart(e.target.value)} />
        </label>
        <span className="range-arrow">→</span>
        <label className="date-range-field">
          <span>{showLabels ? 'End Date' : ''}</span>
          <input type="date" value={end || ''} onChange={e => changeEnd(e.target.value)} />
        </label>
        <label className="quick-range-select">
          <span>{showLabels ? 'Quick Range' : ''}</span>
          <span className="select-with-icon">
            <Icon name="calendar" size={15} />
            <select value={quickRange} onChange={chooseRange} aria-label="Quick date range">
              {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </span>
        </label>
        <button className="btn primary date-apply-btn" onClick={onApply} type="button" disabled={!customSelected && quickRange !== 'custom'}>
          <Icon name="check" size={15} /> {applyLabel}
        </button>
      </div>
    </div>
  )
}
