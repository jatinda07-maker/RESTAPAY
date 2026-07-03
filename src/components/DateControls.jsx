import React from 'react'
import { Icon } from './Icons'

export default function DateControls({
  start,
  end,
  onStartChange,
  onEndChange,
  onApply,
  onPreset,
  className = '',
  showLabels = true,
  applyLabel = 'Apply Date Range'
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
        <label className="date-range-field"><span>{showLabels ? 'Start' : ''}</span><input type="date" value={start || ''} onChange={e => onStartChange(e.target.value)} /></label>
        <span className="range-arrow">→</span>
        <label className="date-range-field"><span>{showLabels ? 'End' : ''}</span><input type="date" value={end || ''} onChange={e => onEndChange(e.target.value)} /></label>
        <button className="btn primary date-apply-btn" onClick={onApply}><Icon name="calendar" size={15} /> {applyLabel}</button>
      </div>
      <div className="quick-preset-group">
        {presets.map(([key, label]) => <button key={key} type="button" className="btn ghost preset-pill" onClick={() => onPreset(key)}>{label}</button>)}
      </div>
    </div>
  )
}
