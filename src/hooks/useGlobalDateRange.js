import { useCallback, useEffect, useMemo, useState } from 'react'

export const DATE_RANGE_KEY = 'restapay-global-date-range'
export const DATE_RANGE_EVENT = 'restapay:date-range-change'

const pad = value => String(value).padStart(2, '0')
export const toInputDate = date => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`

function startOfWeekMonday(date) {
  const value = new Date(date)
  const day = value.getDay()
  value.setDate(value.getDate() + (day === 0 ? -6 : 1-day))
  value.setHours(0,0,0,0)
  return value
}

function endOfWeekSunday(date) {
  const start = startOfWeekMonday(date)
  const end = new Date(start)
  end.setDate(start.getDate()+6)
  return end
}

function quarterStart(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth()/3)*3, 1)
}

export function presetDates(preset, baseDate = new Date()) {
  const today = new Date(baseDate)
  today.setHours(0,0,0,0)
  let from = new Date(today)
  let to = new Date(today)
  switch (preset) {
    case 'today': break
    case 'yesterday': from.setDate(from.getDate()-1); to = new Date(from); break
    case 'week': from = startOfWeekMonday(today); break
    case 'last-week': {
      to = new Date(startOfWeekMonday(today)); to.setDate(to.getDate()-1)
      from = new Date(to); from.setDate(from.getDate()-6)
      break
    }
    case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); break
    case 'last-month': from = new Date(today.getFullYear(), today.getMonth()-1, 1); to = new Date(today.getFullYear(), today.getMonth(), 0); break
    case 'quarter': from = quarterStart(today); break
    case 'last-quarter': {
      const current = quarterStart(today)
      to = new Date(current); to.setDate(to.getDate()-1)
      from = new Date(to.getFullYear(), Math.floor(to.getMonth()/3)*3, 1)
      break
    }
    case 'year': from = new Date(today.getFullYear(),0,1); break
    case 'last-year': from = new Date(today.getFullYear()-1,0,1); to = new Date(today.getFullYear()-1,11,31); break
    default: return null
  }
  return { preset, from: toInputDate(from), to: toInputDate(to) }
}

export function defaultDateRange() { return presetDates('month') }

export function readDateRange() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DATE_RANGE_KEY) || 'null')
    if (parsed?.from && parsed?.to) return parsed
  } catch {}
  return defaultDateRange()
}

export function saveDateRange(range) {
  const normalized = { preset: range.preset || 'custom', from: range.from, to: range.to }
  try { localStorage.setItem(DATE_RANGE_KEY, JSON.stringify(normalized)) } catch {}
  window.dispatchEvent(new CustomEvent(DATE_RANGE_EVENT, { detail: normalized }))
  return normalized
}

export function normalizeRowDate(row, keys = []) {
  for (const key of [...keys, 'date', 'view_date', 'sales_date', 'invoice_date', 'expense_date', 'pay_date', 'payroll_date', 'payment_date', 'created_at']) {
    const raw = row?.[key]
    if (!raw) continue
    const text = String(raw).trim()
    const iso = /^\d{4}-\d{2}-\d{2}/.exec(text)?.[0]
    if (iso) return iso
    const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
    if (us) return `${us[3]}-${pad(us[1])}-${pad(us[2])}`
    const parsed = new Date(text)
    if (!Number.isNaN(parsed.getTime())) return toInputDate(parsed)
  }
  return ''
}

export function inDateRange(row, range, keys = []) {
  const date = normalizeRowDate(row, keys)
  if (!date) return true
  if (range?.from && date < range.from) return false
  if (range?.to && date > range.to) return false
  return true
}

export default function useGlobalDateRange() {
  const [range, setRange] = useState(readDateRange)
  useEffect(() => {
    const update = event => setRange(event?.detail?.from ? event.detail : readDateRange())
    window.addEventListener(DATE_RANGE_EVENT, update)
    window.addEventListener('storage', update)
    return () => { window.removeEventListener(DATE_RANGE_EVENT, update); window.removeEventListener('storage', update) }
  }, [])
  const apply = useCallback(next => setRange(saveDateRange(next)), [])
  return useMemo(() => ({ range, apply }), [range, apply])
}
