import { sortByName } from '../lib/localStore'

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getActiveSortedVendors(vendors = []) {
  const seen = new Set()
  return sortByName((vendors || [])
    .filter(vendor => vendor && vendor.is_active !== false && vendor.name)
    .filter(vendor => {
      const key = normalizeName(vendor.name)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    }))
}

export function findVendorById(vendors = [], id) {
  if (!id) return null
  return (vendors || []).find(vendor => vendor.id === id) || null
}

export function findVendorByName(vendors = [], name) {
  const key = normalizeName(name)
  if (!key) return null
  return (vendors || []).find(vendor => normalizeName(vendor.name) === key) || null
}

export function filterVendors(vendors = [], query = '') {
  const q = String(query || '').toLowerCase().trim()
  if (!q) return vendors
  return vendors.filter(vendor => [
    vendor.name,
    vendor.category,
    vendor.default_check_number,
    vendor.contact,
    vendor.phone,
    vendor.email
  ].join(' ').toLowerCase().includes(q))
}
