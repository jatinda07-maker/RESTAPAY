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

const PRESETS = [
  ['today', 'Today'],
  ['lastWeek', 'Last Week'],
  ['lastMonth', 'Last Month'],
  ['thisMonth', 'This Month'],
  ['all', 'All Dates']
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
  applyLabel = 'Apply',
  activePreset = ''
}) {
  const selectedPreset = activePreset || 'custom'

  function handlePresetChange(event) {
    const value = event.target.value
    if (value !== 'custom') onPreset?.(value)
  }

  return (
    <div className={`date-control-card compact-date-control ${className}`.trim()}>
      <label className="date-preset-field">
        <span>Date Range</span>
        <select value={selectedPreset} onChange={handlePresetChange} aria-label="Choose date range preset">
          <option value="custom">Custom Range</option>
          {PRESETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>

      <div className="date-control-range">
        <label className="date-range-field">
          <span>{showLabels ? 'From' : ''}</span>
          <input
            type="date"
            value={start || ''}
            onClick={openDatePicker}
            onFocus={openDatePicker}
            onChange={event => onStartChange?.(event.target.value)}
          />
        </label>

        <span className="range-arrow" aria-hidden="true">→</span>

        <label className="date-range-field">
          <span>{showLabels ? 'To' : ''}</span>
          <input
            type="date"
            value={end || ''}
            onClick={openDatePicker}
            onFocus={openDatePicker}
            onChange={event => onEndChange?.(event.target.value)}
          />
        </label>

        <button className="btn primary date-apply-btn" onClick={() => onApply?.()} type="button">
          <Icon name="calendar" size={14} />
          <span>{applyLabel}</span>
        </button>
      </div>
    </div>
  )
}
