const n = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

export const SALES_TABS = ['All Sales', 'Cash', 'Credit', 'Other', 'Tips']

export function saleDate(row) {
  return row.business_date || row.date || ''
}

export function saleNet(row) {
  return n(row.net_sales ?? row.amount ?? row.sales)
}

export function saleTips(row) {
  return n(row.tips_collected ?? row.original_tips ?? row.tips)
}

export function salePaymentAmount(row, type) {
  const payment = String(row.payment || row.payment_type || '').toLowerCase()
  if (type === 'Cash') return n(row.cash_sales ?? (payment === 'cash' ? row.amount : 0))
  if (type === 'Credit') return n(row.credit_sales ?? (/credit|card|debit/.test(payment) ? row.amount : 0))
  if (type === 'Other') {
    const explicit = n(row.other_payments) + n(row.gift_card_sales) + n(row.delivery_orders)
    return explicit || (/other|gift|delivery|doordash|house/.test(payment) ? n(row.amount) : 0)
  }
  if (type === 'Tips') return saleTips(row)
  return saleNet(row)
}

export function saleCategoryLabel(row) {
  const food = n(row.food_sales)
  const alcohol = n(row.alcohol_sales)
  const other = n(row.other_sales)
  if (food > 0 && alcohol > 0) return 'Food + Alcohol'
  if (alcohol > 0) return 'Alcohol'
  if (food > 0) return 'Food'
  if (other > 0) return 'Other'
  return row.category || 'Uncategorized'
}

export function salePaymentLabel(row, tab = 'All Sales') {
  if (tab !== 'All Sales') return tab === 'Tips' ? 'Tips' : tab
  const components = ['Cash', 'Credit', 'Other'].filter(type => salePaymentAmount(row, type) > 0)
  if (components.length > 1) return 'Mixed'
  if (components.length === 1) return components[0]
  return row.payment || row.payment_type || 'Unassigned'
}

export function salesViewRows(rows, { tab = 'All Sales', payment = 'All Payments', query = '', location = 'All Locations' } = {}) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase()
  return (Array.isArray(rows) ? rows.filter(Boolean) : []).map(row => {
    const amount = salePaymentAmount(row, tab)
    return {
      ...row,
      view_amount: round2(amount),
      view_tips: round2(saleTips(row)),
      view_category: saleCategoryLabel(row),
      view_payment: salePaymentLabel(row, tab),
      view_date: saleDate(row),
    }
  }).filter(row => {
    const tabMatch = tab === 'All Sales' ? saleNet(row) !== 0 || saleTips(row) !== 0 : row.view_amount !== 0
    const paymentMatch = payment === 'All Payments' || salePaymentAmount(row, payment) !== 0
    const locationMatch = location === 'All Locations' || row.location === location
    const haystack = [row.view_date, row.view_category, row.view_payment, row.source, row.location, row.source_file, row.import_note]
      .join(' ').toLowerCase()
    const queryMatch = !normalizedQuery || haystack.includes(normalizedQuery)
    return tabMatch && paymentMatch && locationMatch && queryMatch
  }).sort((a, b) => String(b.view_date).localeCompare(String(a.view_date)))
}

export function summarizeSales(rows) {
  return rows.reduce((acc, row) => {
    acc.net += saleNet(row)
    acc.cash += salePaymentAmount(row, 'Cash')
    acc.credit += salePaymentAmount(row, 'Credit')
    acc.other += salePaymentAmount(row, 'Other')
    acc.gift += n(row.gift_card_sales)
    acc.tips += saleTips(row)
    acc.food += n(row.food_sales)
    acc.alcohol += n(row.alcohol_sales)
    acc.tax += n(row.tax)
    acc.discounts += n(row.discounts)
    acc.refunds += n(row.refunds)
    return acc
  }, { net: 0, cash: 0, credit: 0, other: 0, gift: 0, tips: 0, food: 0, alcohol: 0, tax: 0, discounts: 0, refunds: 0 })
}
