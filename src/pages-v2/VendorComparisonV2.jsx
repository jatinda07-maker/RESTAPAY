import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { enrichInvoiceItem, normalizeVendorName } from '../engine/InvoiceProductEngine'

const PAGE_SIZE = 10
const num = value => Number(String(value ?? '').replace(/[$,%(),]/g,'').trim()) || 0
const money = value => `$${num(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
const normalizeName = value => String(value || '').toLowerCase().replace(/\b(case|cs|pack|pk|bottle|btl|box|bag|each|ea|count|ct)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')
const iso = value => { if (!value) return ''; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value).slice(0,10) : date.toISOString().slice(0,10) }

export default function VendorComparisonV2({ data }) {
  const [vendorA,setVendorA] = useState('')
  const [vendorB,setVendorB] = useState('')
  const [category,setCategory] = useState('all')
  const [search,setSearch] = useState('')
  const [page,setPage] = useState(1)
  const [selected,setSelected] = useState(null)

  const invoicesById = useMemo(() => Object.fromEntries((data.invoices || []).map(row => [String(row.id),row])),[data.invoices])
  const vendors = useMemo(() => {
    const names = new Set((data.vendors || []).map(item => item.name).filter(Boolean))
    ;(data.invoices || []).forEach(row => { if (row.vendor || row.vendor_name) names.add(row.vendor || row.vendor_name) })
    return [...names].sort((a,b) => String(a).localeCompare(String(b)))
  },[data.vendors,data.invoices])

  const rows = useMemo(() => (data.invoiceItems || []).map(item => {
    const invoice = invoicesById[String(item.invoice_id || item.invoiceId)] || {}
    const enriched = enrichInvoiceItem(item)
    const description = item.description || item.item_name || item.name || 'Unnamed item'
    return {...item,vendor:item.vendor || item.vendor_name || invoice.vendor || invoice.vendor_name || '',description,category:item.category || invoice.category || 'Other',date:iso(item.invoice_date || item.date || invoice.invoice_date || invoice.date),size:enriched.package_label || item.size || item.package_size || item.pack_size || item.unit || item.uom || 'Unspecified',cost:num(enriched.normalized_unit_cost || item.normalized_unit_cost || item.unit_cost || item.unitCost || item.price_each || item.priceEach || item.unit_price),normalizedUnit:enriched.normalized_unit || 'unit',quantity:num(item.quantity ?? item.qty) || 1,normalized:normalizeName(description)}
  }).filter(row => row.vendor && row.normalized),[data.invoiceItems,invoicesById])

  const categories = useMemo(() => [...new Set(rows.map(row => row.category).filter(Boolean))].sort(),[rows])
  const comparison = useMemo(() => {
    if (!vendorA || !vendorB || vendorA === vendorB) return []
    const grouped = new Map()
    rows.filter(row => [normalizeVendorName(vendorA),normalizeVendorName(vendorB)].includes(normalizeVendorName(row.vendor)))
      .filter(row => category === 'all' || String(row.category).toLowerCase() === category.toLowerCase())
      .filter(row => !search.trim() || `${row.description} ${row.size} ${row.category}`.toLowerCase().includes(search.trim().toLowerCase()))
      .forEach(row => { const key = `${row.normalized}|${String(row.normalizedUnit).toLowerCase()}`; const group = grouped.get(key) || {key,description:row.description,size:row.size,normalizedUnit:row.normalizedUnit,category:row.category,history:[]}; group.history.push(row); grouped.set(key,group) })
    return [...grouped.values()].map(group => {
      const latestFor = name => group.history.filter(row => normalizeVendorName(row.vendor) === normalizeVendorName(name)).sort((a,b) => String(b.date).localeCompare(String(a.date)))[0]
      const left = latestFor(vendorA), right = latestFor(vendorB), leftCost = left?.cost || 0, rightCost = right?.cost || 0
      const hasBoth = Boolean(left && right)
      const best = hasBoth ? (leftCost < rightCost ? vendorA : rightCost < leftCost ? vendorB : 'Equal') : (left ? vendorA : right ? vendorB : '—')
      return {...group,left,right,leftCost,rightCost,best,savings:hasBoth ? Math.abs(leftCost-rightCost) : 0,average:group.history.reduce((sum,row) => sum + row.cost,0)/Math.max(group.history.length,1)}
    }).sort((a,b) => b.savings-a.savings || a.description.localeCompare(b.description))
  },[rows,vendorA,vendorB,category,search])

  const compared = comparison.filter(row => row.left && row.right)
  const lowerA = comparison.filter(row => row.best === vendorA).length
  const lowerB = comparison.filter(row => row.best === vendorB).length
  const averageA = compared.length ? compared.reduce((sum,row) => sum + row.leftCost,0)/compared.length : 0
  const averageB = compared.length ? compared.reduce((sum,row) => sum + row.rightCost,0)/compared.length : 0
  const totalPages = Math.max(1,Math.ceil(comparison.length/PAGE_SIZE)); const currentPage = Math.min(page,totalPages); const visible = comparison.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE)
  const better = !compared.length ? 'No comparison' : averageA < averageB ? vendorA : averageB < averageA ? vendorB : 'Equal pricing'
  const clearFilters = () => { setCategory('all'); setSearch(''); setPage(1) }

  return <div className="rv2-page rv2-entity-v2 rv2-vendor-comparison-v2"><div className="rv2-mock-page rv2-vendor-comparison-mock">
    <section className="rv2-compare-controls"><label>Category<select value={category} onChange={e => {setCategory(e.target.value);setPage(1)}}><option value="all">All Categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label>Item<div className="rv2-search-control"><Icon name="search" size={15}/><input value={search} onChange={e => {setSearch(e.target.value);setPage(1)}} placeholder="All Items"/></div></label><label>Unit<select disabled><option>All Units</option></select></label><button className="rv2-primary-button" onClick={() => setPage(1)}><Icon name="compare" size={16}/> Compare</button></section>
    <section className="rv2-vendor-pair"><label>Vendor A<select value={vendorA} onChange={e => {setVendorA(e.target.value);setPage(1)}}><option value="">Select vendor</option>{vendors.map(name => <option key={name}>{name}</option>)}</select></label><span className="rv2-swap-icon"><Icon name="compare" size={17}/></span><label>Vendor B<select value={vendorB} onChange={e => {setVendorB(e.target.value);setPage(1)}}><option value="">Select vendor</option>{vendors.map(name => <option key={name}>{name}</option>)}</select></label><button className="rv2-clear-button" onClick={clearFilters}>Clear Filters</button></section>
    <div className="rv2-compare-summary"><div className="tone-green"><strong>{vendorA || 'Vendor A'}</strong><small>Total Items</small><b>{comparison.filter(row => row.left).length}</b><small>Avg Price</small><b>{money(averageA)}</b></div><div className="tone-purple"><small>Better Price</small><strong>{better}</strong><b>{compared.length} items compared</b></div><div className="tone-orange"><strong>{vendorB || 'Vendor B'}</strong><small>Total Items</small><b>{comparison.filter(row => row.right).length}</b><small>Avg Price</small><b>{money(averageB)}</b></div></div>
    <section className="rv2-data-panel"><div className="rv2-panel-title"><div><h2>Top Item Comparison</h2><p>Latest normalized apples-to-apples unit prices.</p></div><span>{lowerA} lower for {vendorA || 'A'} · {lowerB} lower for {vendorB || 'B'}</span></div><div className="rv2-table-scroll"><table className="rv2-mock-table rv2-comparison-table"><thead><tr><th>Item</th><th>Unit</th><th>{vendorA || 'Vendor A'}</th><th>{vendorB || 'Vendor B'}</th><th>Difference</th><th>Better Price</th><th>History</th></tr></thead><tbody>{(!vendorA || !vendorB) ? <tr><td colSpan="7" className="rv2-empty-row">Select two vendors to begin comparison.</td></tr> : vendorA === vendorB ? <tr><td colSpan="7" className="rv2-empty-row">Choose two different vendors.</td></tr> : visible.length ? visible.map(row => <tr key={row.key}><td><strong>{row.description}</strong><small className="rv2-cell-subtext">{row.category}</small></td><td>{row.size}</td><td>{row.left ? money(row.leftCost) : '—'}</td><td>{row.right ? money(row.rightCost) : '—'}</td><td className={row.left && row.right ? (row.leftCost === row.rightCost ? '' : 'rv2-negative') : ''}>{row.left && row.right ? money(row.savings) : '—'}</td><td><span className={`rv2-badge ${row.best === vendorA ? 'status-active' : row.best === vendorB ? 'status-open' : ''}`}>{row.best}</span></td><td><div className="rv2-row-icon-actions"><button title="View price history" onClick={() => setSelected(row)}><Icon name="history" size={15}/></button></div></td></tr>) : <tr><td colSpan="7" className="rv2-empty-row">No matching invoice line items were found.</td></tr>}</tbody></table></div><div className="rv2-table-footer"><div>Show <select value={PAGE_SIZE} disabled><option>{PAGE_SIZE}</option></select> entries</div><div className="rv2-pagination"><button disabled={currentPage<=1} onClick={() => setPage(value => Math.max(1,value-1))}>‹</button>{Array.from({length:totalPages},(_,index)=>index+1).slice(0,5).map(number => <button key={number} className={currentPage===number?'is-active':''} onClick={() => setPage(number)}>{number}</button>)}<button disabled={currentPage>=totalPages} onClick={() => setPage(value => Math.min(totalPages,value+1))}>›</button></div></div></section>
    {selected && <div className="rv2-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><section className="rv2-form-modal rv2-history-modal" role="dialog" aria-modal="true"><header><div className="rv2-modal-title"><span><Icon name="history" size={22}/></span><div><h2>{selected.description}</h2><p>{selected.size} · {selected.category}</p></div></div><button className="rv2-modal-close" onClick={() => setSelected(null)}><Icon name="x" size={18}/></button></header><div className="rv2-popup-scroll rv2-history-table"><table className="rv2-mock-table"><thead><tr><th>Date</th><th>Vendor</th><th>Quantity</th><th>Unit Cost</th><th>Package</th></tr></thead><tbody>{[...selected.history].sort((a,b) => String(b.date).localeCompare(String(a.date))).map((row,index) => <tr key={`${row.id || index}-${row.date}`}><td>{row.date || '—'}</td><td>{row.vendor}</td><td>{row.quantity}</td><td>{money(row.cost)}</td><td>{row.size}</td></tr>)}</tbody></table></div><footer><span>Average unit cost</span><strong>{money(selected.average)}</strong><button className="rv2-clear-button" onClick={() => setSelected(null)}>Close</button></footer></section></div>}
  </div></div>
}
