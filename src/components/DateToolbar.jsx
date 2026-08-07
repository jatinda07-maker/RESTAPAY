import { CalendarDays, ChevronDown } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'

function toInputDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getPresetDates(preset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (preset === 'today') {
    const value = toInputDate(today)
    return { from: value, to: value }
  }
  if (preset === 'week') {
    const start = new Date(today)
    const weekday = start.getDay()
    start.setDate(start.getDate() + (weekday === 0 ? -6 : 1 - weekday))
    return { from: toInputDate(start), to: toInputDate(today) }
  }
  if (preset === 'month') {
    return { from: toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: toInputDate(today) }
  }
  return null
}

function openPicker(ref) {
  if (!ref.current) return
  if (typeof ref.current.showPicker === 'function') ref.current.showPicker()
  else ref.current.focus()
}

export default function DateToolbar() {
  const initialDates = useMemo(() => getPresetDates('month'), [])
  const [preset, setPreset] = useState('month')
  const [fromDate, setFromDate] = useState(initialDates.from)
  const [toDate, setToDate] = useState(initialDates.to)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  function handlePresetChange(event) {
    const nextPreset = event.target.value
    setPreset(nextPreset)
    const dates = getPresetDates(nextPreset)
    if (dates) {
      setFromDate(dates.from)
      setToDate(dates.to)
    }
  }

  function handleManualChange(setter, value) {
    setter(value)
    setPreset('custom')
  }

  return (
    <section className="date-toolbar card-surface">
      <label className="compact-range-select" aria-label="Date range preset">
        <CalendarDays size={16} />
        <select value={preset} onChange={handlePresetChange}>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        <ChevronDown size={14} aria-hidden="true" />
      </label>

      <div className="compact-date-range">
        <button type="button" className="compact-date-field" onClick={() => openPicker(fromRef)}>
          <span>From</span>
          <input ref={fromRef} type="date" value={fromDate} onClick={(event) => event.stopPropagation()} onChange={(event) => handleManualChange(setFromDate, event.target.value)} />
        </button>
        <span className="date-range-divider">—</span>
        <button type="button" className="compact-date-field" onClick={() => openPicker(toRef)}>
          <span>To</span>
          <input ref={toRef} type="date" value={toDate} onClick={(event) => event.stopPropagation()} onChange={(event) => handleManualChange(setToDate, event.target.value)} />
        </button>
      </div>

      <button className="primary-button compact-apply" type="button">Apply</button>
    </section>
  )
}
