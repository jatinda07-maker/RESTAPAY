import { CalendarDays, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useGlobalDateRange, { presetDates } from '../hooks/useGlobalDateRange'
import { useFeedback } from './AppFeedback'

function openPicker(ref) {
  if (!ref.current) return
  if (typeof ref.current.showPicker === 'function') ref.current.showPicker()
  else ref.current.focus()
}

export default function DateToolbar() {
  const { range, apply } = useGlobalDateRange()
  const { notify } = useFeedback()
  const [preset, setPreset] = useState(range.preset || 'custom')
  const [fromDate, setFromDate] = useState(range.from)
  const [toDate, setToDate] = useState(range.to)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  useEffect(() => {
    setPreset(range.preset || 'custom')
    setFromDate(range.from)
    setToDate(range.to)
  }, [range.preset, range.from, range.to])

  function handlePresetChange(event) {
    const nextPreset = event.target.value
    setPreset(nextPreset)
    const dates = presetDates(nextPreset)
    if (dates) { setFromDate(dates.from); setToDate(dates.to) }
  }

  function handleManualChange(setter, value) {
    setter(value)
    setPreset('custom')
  }

  function handleApply() {
    if (!fromDate || !toDate) return notify('Choose both From and To dates.', 'error')
    if (fromDate > toDate) return notify('From date cannot be after To date.', 'error')
    apply({ preset, from: fromDate, to: toDate })
    notify(`Date range applied: ${fromDate} through ${toDate}.`, 'success')
  }

  return (
    <section className="date-toolbar card-surface">
      <label className="compact-range-select" aria-label="Date range preset">
        <CalendarDays size={16} />
        <select value={preset} onChange={handlePresetChange}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="week">This Week</option>
          <option value="last-week">Last Week</option>
          <option value="month">This Month</option>
          <option value="last-month">Last Month</option>
          <option value="quarter">This Quarter</option>
          <option value="last-quarter">Last Quarter</option>
          <option value="year">This Year</option>
          <option value="last-year">Last Year</option>
          <option value="custom">Custom Range</option>
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>

      <div className="compact-date-range">
        <button type="button" className="compact-date-field" onClick={() => openPicker(fromRef)}>
          <span>From</span>
          <input ref={fromRef} type="date" value={fromDate} onClick={event => event.stopPropagation()} onChange={event => handleManualChange(setFromDate, event.target.value)} />
        </button>
        <span className="date-range-divider">—</span>
        <button type="button" className="compact-date-field" onClick={() => openPicker(toRef)}>
          <span>To</span>
          <input ref={toRef} type="date" value={toDate} onClick={event => event.stopPropagation()} onChange={event => handleManualChange(setToDate, event.target.value)} />
        </button>
      </div>

      <button className="primary-button compact-apply" type="button" onClick={handleApply}>Apply</button>
    </section>
  )
}
