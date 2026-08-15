const DOMAIN_MAP = {
  'us foods': 'usfoods.com',
  'sysco': 'sysco.com',
  'performance foodservice': 'performancefoodservice.com',
  'performance foodservice alabama': 'performancefoodservice.com',
  'pfg': 'pfgc.com',
  'sams club': 'samsclub.com',
  "sam's club": 'samsclub.com',
  'walmart': 'walmart.com',
  'publix': 'publix.com',
  'toast': 'toasttab.com',
  'cintas': 'cintas.com',
  'coca cola': 'coca-cola.com',
  'coca-cola': 'coca-cola.com',
  'pepsi': 'pepsi.com',
  'pepsico': 'pepsico.com',
  'spire gas': 'spireenergy.com',
  'spire': 'spireenergy.com',
  'valley bank': 'valley.com',
  'wayne gentry': 'waynegentry.com',
  'rj young company': 'rjyoung.com',
  'rj young': 'rjyoung.com',
  'spark light': 'sparklight.com',
  'sparklight': 'sparklight.com',
  'adams budweiser': 'anheuser-busch.com',
  'budweiser': 'budweiser.com',
  'alabama abc board': 'alabcboard.gov',
  'abc board': 'alabcboard.gov',
  'sba loan': 'sba.gov'
}

export const normalizeVendorName = value => String(value ?? '')
  .trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()

export function vendorInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'V'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase()
}

export function findVendorDomain(name, website = '') {
  const explicit = String(website || '').trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '')
  if (explicit.includes('.')) return explicit
  const normalized = normalizeVendorName(name)
  if (DOMAIN_MAP[normalized]) return DOMAIN_MAP[normalized]
  const partial = Object.entries(DOMAIN_MAP).find(([key]) => normalized.includes(key) || key.includes(normalized))
  return partial?.[1] || ''
}

export function vendorLogoUrl(domain) {
  const safe = String(domain || '').trim().replace(/^www\./i, '')
  return safe ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(safe)}&sz=128` : ''
}

export function buildVendorLogoMatch(vendor) {
  const domain = findVendorDomain(vendor?.name, vendor?.website || vendor?.website_domain)
  if (!domain) return null
  return {
    website: vendor?.website || `https://${domain}`,
    website_domain: domain,
    logo_url: vendorLogoUrl(domain),
    logo_source: 'google-favicon-domain',
    logo_verified: true
  }
}
