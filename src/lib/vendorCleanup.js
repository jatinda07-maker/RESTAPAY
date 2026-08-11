const suffixes = new Set(['inc','incorporated','llc','ltd','limited','co','company','corp','corporation'])

export function normalizeVendorName(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function coreTokens(value = '') {
  return normalizeVendorName(value).split(' ').filter(Boolean).filter(token => !suffixes.has(token))
}

export function vendorSimilarity(a = '', b = '') {
  const left = normalizeVendorName(a)
  const right = normalizeVendorName(b)
  if (!left || !right) return 0
  if (left === right) return 1
  const leftTokens = coreTokens(left)
  const rightTokens = coreTokens(right)
  if (!leftTokens.length || !rightTokens.length) return 0
  const leftSet = new Set(leftTokens)
  const rightSet = new Set(rightTokens)
  const intersection = [...leftSet].filter(token => rightSet.has(token)).length
  const union = new Set([...leftSet, ...rightSet]).size || 1
  const jaccard = intersection / union
  const coreLeft = leftTokens.join(' ')
  const coreRight = rightTokens.join(' ')
  if (coreLeft === coreRight) return 0.97
  const containment = coreLeft.includes(coreRight) || coreRight.includes(coreLeft) ? 0.9 : 0
  return Math.max(jaccard, containment)
}

export function findSimilarVendors(vendors = [], name = '', excludeId = null, threshold = 0.72) {
  return (Array.isArray(vendors) ? vendors : [])
    .filter(Boolean)
    .filter(vendor => vendor.id !== excludeId)
    .map(vendor => ({ vendor, score: vendorSimilarity(vendor.name, name) }))
    .filter(item => item.score >= threshold)
    .sort((a, b) => b.score - a.score || String(a.vendor.name || '').localeCompare(String(b.vendor.name || ''), undefined, { sensitivity: 'base' }))
}

export function dedupeVendorOptions(vendors = []) {
  const map = new Map()
  for (const vendor of (Array.isArray(vendors) ? vendors : []).filter(Boolean)) {
    const key = normalizeVendorName(vendor.name)
    if (!key) continue
    const current = map.get(key)
    if (!current || (current.is_active === false && vendor.is_active !== false)) map.set(key, vendor)
  }
  return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }))
}

export function findVendorDuplicateGroups(vendors = [], threshold = 0.9) {
  const rows = (Array.isArray(vendors) ? vendors : []).filter(Boolean)
  const groups = []
  const used = new Set()
  for (let i = 0; i < rows.length; i += 1) {
    if (used.has(rows[i].id)) continue
    const matches = []
    for (let j = i + 1; j < rows.length; j += 1) {
      if (used.has(rows[j].id)) continue
      const score = vendorSimilarity(rows[i].name, rows[j].name)
      if (score >= threshold) matches.push({ vendor: rows[j], score })
    }
    if (matches.length) {
      groups.push({ canonical: rows[i], matches })
      used.add(rows[i].id)
      matches.forEach(match => used.add(match.vendor.id))
    }
  }
  return groups
}
