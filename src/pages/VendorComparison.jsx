import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { monthToDateRange, presetRange } from '../engine/DateEngine'

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/[$,%(),]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}
function money(value) { return `$${num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function iso(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return date.toISOString().slice(0, 10)
}
function normalizeVendor(value) { return String(value || '').trim().toLowerCase() }
function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(case|cs|pack|pk|bottle|btl|box|bag|each|ea|count|ct)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}
function sizeText(row) {
  const raw = row.size || row.package_size || row.pack_size || row.unit || row.uom || row.measure || ''
  return String(raw || '').trim() || 'Unspecified'
}
function unitCost(row) {
  const explicit = num(row.unit_cost ?? row.unitCost ?? row.price_each ?? row.priceEach)
  if (explicit) return explicit
  const qty = num(row.quantity ?? row.qty ?? row.case_qty ?? row.pack_qty) || 1
  return num(row.line_total ?? row.total ?? row.amount ?? row.extended_total) / qty
}
function invoiceDate(invoice, row) { return iso(row.invoice_date || row.date || invoice?.invoice_date || invoice?.date) }

export default function VendorComparison({ data }) {
  const defaults = monthToDateRange()
  const [dateStart, setDateStart] = useState(defaults.start)
  const [dateEnd, setDateEnd] = useState(defaults.end)
  const [vendorA, setVendorA] = useState('')
  const [vendorB, setVendorB] = useState('')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)

  const invoicesById = useMemo(() => Object.fromEntries((data.invoices || []).map(row => [String(row.id), row])), [data.invoices])
  const vendors = useMemo(() => {
    const names = new Set((data.vendors || []).map(v => v.name).filter(Boolean))
    ;(data.invoices || []).forEach(row => { if (row.vendor || row.vendor_name) names.add(row.vendor || row.vendor_name) })
    return [...names].sort((a, b) => String(a).localeCompare(String(b)))
  }, [data.vendors, data.invoices])

  const rows = useMemo(() => {
    return (data.invoiceItems || []).map(item => {
      const invoice = invoicesById[String(item.invoice_id || item.invoiceId)] || {}
      const vendor = item.vendor || item.vendor_name || invoice.vendor || invoice.vendor_name || ''
      const description = item.description || item.item_name || item.name || 'Unnamed item'
      const categoryName = item.category || invoice.category || 'Other'
      return {
        ...item,
        vendor,
        description,
        category: categoryName,
        date: invoiceDate(invoice, item),
        size: sizeText(item),
        cost: unitCost(item),
        quantity: num(item.quantity ?? item.qty) || 1,
        normalized: normalizeName(description),
      }
    }).filter(row => row.vendor && row.normalized && (!dateStart || row.date >= dateStart) && (!dateEnd || row.date <= dateEnd))
  }, [data.invoiceItems, invoicesById, dateStart, dateEnd])

  const categories = useMemo(() => [...new Set(rows.map(row => row.category).filter(Boolean))].sort(), [rows])

  const comparison = useMemo(() => {
    if (!vendorA || !vendorB || vendorA === vendorB) return []
    const filtered = rows.filter(row => {
      if (![normalizeVendor(vendorA), normalizeVendor(vendorB)].includes(normalizeVendor(row.vendor))) return false
      if (category !== 'all' && String(row.category).toLowerCase() !== category.toLowerCase()) return false
      const q = search.trim().toLowerCase()
      if (q && !`${row.description} ${row.size} ${row.category}`.toLowerCase().includes(q)) return false
      return true
    })
    const grouped = new Map()
    filtered.forEach(row => {
      const key = `${row.normalized}|${String(row.size).toLowerCase()}`
      const group = grouped.get(key) || { key, description: row.description, size: row.size, category: row.category, history: [] }
      group.history.push(row)
      grouped.set(key, group)
    })
    return [...grouped.values()].map(group => {
      const latestFor = name => group.history.filter(row => normalizeVendor(row.vendor) === normalizeVendor(name)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0]
      const left = latestFor(vendorA)
      const right = latestFor(vendorB)
      const leftCost = left?.cost || 0
      const rightCost = right?.cost || 0
      const hasBoth = Boolean(left && right)
      const best = hasBoth ? (leftCost < rightCost ? vendorA : rightCost < leftCost ? vendorB : 'Same price') : (left ? vendorA : right ? vendorB : '-')
      const savings = hasBoth ? Math.abs(leftCost - rightCost) : 0
      const avg = group.history.reduce((sum, row) => sum + row.cost, 0) / Math.max(group.history.length, 1)
      return { ...group, left, right, leftCost, rightCost, best, savings, average: avg }
    }).sort((a, b) => b.savings - a.savings || a.description.localeCompare(b.description))
  }, [rows, vendorA, vendorB, category, search])

  const savingsTotal = comparison.reduce((sum, row) => sum + row.savings, 0)
  const comparedCount = comparison.filter(row => row.left && row.right).length
  const cheapestA = comparison.filter(row => row.best === vendorA).length
  const cheapestB = comparison.filter(row => row.best === vendorB).length

  function applyPreset(key) {
    const range = presetRange(key)
    setDateStart(range.start)
    setDateEnd(range.end)
  }

  return <div className="vendor-comparison-page">
    <section className="vc-hero">
      <div>
        <span className="eyebrow">Purchasing Intelligence</span>
        <h2>Vendor Comparison</h2>
        <p>Compare actual invoice line-item prices, package sizes, unit costs, and purchase history between vendors.</p>
      </div>
      <div className="vc-hero-icon"><Icon name="compare" size={24} /></div>
    </section>

    <section className="filter-card vc-filters">
      <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={() => {}} onPreset={applyPreset} applyLabel="Apply" />
      <label><span>Vendor A</span><select value={vendorA} onChange={event => setVendorA(event.target.value)}><option value="">Select vendor</option>{vendors.map(name => <option key={name}>{name}</option>)}</select></label>
      <label><span>Vendor B</span><select value={vendorB} onChange={event => setVendorB(event.target.value)}><option value="">Select vendor</option>{vendors.map(name => <option key={name}>{name}</option>)}</select></label>
      <label><span>Category</span><select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All Categories</option>{categories.map(name => <option key={name}>{name}</option>)}</select></label>
    </section>

    <section className="vc-toolbar">
      <label className="compact-search"><Icon name="search" size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search item, package size, or category" /></label>
      <button type="button" className="btn-secondary" onClick={() => { setSearch(''); setCategory('all') }}><Icon name="refresh" size={16} /> Clear</button>
    </section>

    <div className="vc-summary-grid">
      <div><span>Compared Items</span><strong>{comparedCount}</strong><small>with prices from both vendors</small></div>
      <div><span>Potential Unit Savings</span><strong>{money(savingsTotal)}</strong><small>sum of latest unit-price differences</small></div>
      <div><span>{vendorA || 'Vendor A'} Lower</span><strong>{cheapestA}</strong><small>items with the better price</small></div>
      <div><span>{vendorB || 'Vendor B'} Lower</span><strong>{cheapestB}</strong><small>items with the better price</small></div>
    </div>

    <section className="table-card vc-table-card">
      <header><div><h2>Item Price Comparison</h2><p>Latest normalized unit cost by item and package size</p></div></header>
      {!vendorA || !vendorB ? <div className="empty-state">Select two vendors above to begin comparison.</div>
        : vendorA === vendorB ? <div className="empty-state">Choose two different vendors.</div>
          : <div className="table-wrap"><table className="vendor-comparison-table"><thead><tr><th>Item</th><th>Category</th><th>Size / Unit</th><th>{vendorA}</th><th>{vendorB}</th><th>Difference</th><th>Best Price</th><th>History</th></tr></thead><tbody>
            {comparison.map(row => <tr key={row.key}>
              <td><b>{row.description}</b><small>{row.history.length} purchase record{row.history.length === 1 ? '' : 's'}</small></td>
              <td>{row.category}</td><td>{row.size}</td>
              <td>{row.left ? <><b>{money(row.leftCost)}</b><small>{row.left.date || 'No date'}</small></> : '-'}</td>
              <td>{row.right ? <><b>{money(row.rightCost)}</b><small>{row.right.date || 'No date'}</small></> : '-'}</td>
              <td>{row.left && row.right ? money(row.savings) : '-'}</td>
              <td><span className={`tag ${row.best === vendorA ? 'cash' : row.best === vendorB ? 'check' : ''}`}>{row.best}</span></td>
              <td><button type="button" className="icon-btn compact" title="View price history" onClick={() => setSelected(row)}><Icon name="history" size={16} /></button></td>
            </tr>)}
            {!comparison.length && <tr><td colSpan="8">No matching invoice line items were found for the selected vendors and filters.</td></tr>}
          </tbody></table></div>}
    </section>

    {selected && <div className="modal-backdrop" onMouseDown={() => setSelected(null)}><section className="modal-card vc-history-modal" onMouseDown={event => event.stopPropagation()}>
      <header><div><h2>{selected.description}</h2><p>{selected.size} · {selected.category}</p></div><button type="button" className="icon-btn" onClick={() => setSelected(null)}><Icon name="x" /></button></header>
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Vendor</th><th>Quantity</th><th>Unit Cost</th><th>Package</th></tr></thead><tbody>{[...selected.history].sort((a,b) => String(b.date).localeCompare(String(a.date))).map((row, index) => <tr key={`${row.id || index}-${row.date}`}><td>{row.date}</td><td>{row.vendor}</td><td>{row.quantity}</td><td>{money(row.cost)}</td><td>{row.size}</td></tr>)}</tbody></table></div>
      <footer><span>Average unit cost</span><strong>{money(selected.average)}</strong></footer>
    </section></div>}
  </div>
}
