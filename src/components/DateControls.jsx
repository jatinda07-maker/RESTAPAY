import React from 'react'
import { Icon } from './Icons'

function openDatePicker(event) {
  const input = event.currentTarget
  try {
    if (typeof input.showPicker === 'function') input.showPicker()
  } catch {
    input.focus()
  }
}

export default function DateControls({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  onPreset,
  className = '',
  showLabels = true,
  applyLabel = 'Apply Date Range',
  activePreset = ''
}) {
  const presets = [
    ['today', 'Today'],
    ['lastWeek', 'Last Week'],
    ['lastMonth', 'Last Month'],
    ['thisMonth', 'This Month'],
    ['all', 'All Dates']
  ]

  return (
    <div className={`date-control-card ${className}`.trim()}>
      <div className="date-control-range">
        <label className="date-range-field">
          <span>{showLabels ? 'Start' : ''}</span>
          <input type="date" value={start || ''} onClick={openDatePicker} onFocus={openDatePicker} onChange={event => onStartChange?.(event.target.value)} />
        </label>
        <span className="range-arrow" aria-hidden="true">→</span>
        <label className="date-range-field">
          <span>{showLabels ? 'End' : ''}</span>
          <input type="date" value={end || ''} onClick={openDatePicker} onFocus={openDatePicker} onChange={event => onEndChange?.(event.target.value)} />
        </label>
        <button className="btn primary date-apply-btn" onClick={() => onApply?.()} type="button">
          <Icon name="calendar" size={15} /> {applyLabel}
        </button>
      </div>
      <div className="quick-preset-group">
        {presets.map(([key, label]) => (
          <button key={key} type="button" className={`btn ghost preset-pill ${activePreset === key ? 'active' : ''}`.trim()} onClick={() => onPreset?.(key)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
