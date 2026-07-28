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
<<<<<<< HEAD
  const presets = [
    ['today', 'Today', '#16803f'],
    ['lastWeek', 'Last Week', '#0f7c83'],
    ['lastMonth', 'Last Month', '#2447a8'],
    ['thisMonth', 'This Month', '#7527c7'],
    ['all', 'All Dates', '#1762cf']
  ]
=======
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
>>>>>>> d386310 (RC5: Fix Toast Shifts Closed tipped payroll import)

  return (
    <div className={`date-control-card date-control-professional ${className}`.trim()}>
      <div className="date-control-range">
        <label className="date-range-field">
          <span>{showLabels ? 'Start Date' : ''}</span>
          <input type="date" value={start || ''} onChange={e => changeStart(e.target.value)} />
        </label>
        <span className="range-arrow">→</span>
<<<<<<< HEAD
        <label className="date-range-field"><span>{showLabels ? 'End' : ''}</span><input type="date" value={end || ''} onChange={e => onEndChange(e.target.value)} /></label>
        <button className="btn primary date-apply-btn" onClick={onApply} type="button"><Icon name="calendar" size={15} /> {applyLabel}</button>
      </div>
      <div className="quick-preset-group">
        {presets.map(([key, label, color]) => <button key={key} type="button" className={`btn preset-pill preset-${key}`} style={{backgroundColor:color,borderColor:color,color:'#fff'}} onClick={() => onPreset(key)}><Icon name="calendar" size={14}/>{label}</button>)}
=======
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
>>>>>>> d386310 (RC5: Fix Toast Shifts Closed tipped payroll import)
      </div>
    </div>
  )
}
