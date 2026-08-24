export const asArray = value => Array.isArray(value) ? value.filter(Boolean) : []
export const asText = (value, fallback = '') => value == null ? fallback : String(value)
export const lower = value => asText(value).toLowerCase()
export const safeStatus = (value, fallback = 'Inactive') => asText(value, fallback).trim() || fallback
export const searchableText = value => {
  if (!value || typeof value !== 'object') return lower(value)
  return Object.values(value).map(item => {
    if (item == null) return ''
    if (typeof item === 'object') {
      try { return JSON.stringify(item) } catch { return '' }
    }
    return String(item)
  }).join(' ').toLowerCase()
}
export const initials = value => asText(value, 'Unknown').trim().split(/\s+/).filter(Boolean).map(part => part[0] || '').join('').slice(0, 2).toUpperCase() || '??'
