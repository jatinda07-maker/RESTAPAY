import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId, sortByName } from '../lib/localStore'
import { normalizeVendorName, vendorSimilarity } from '../engine/InvoiceProductEngine'

const blankVendor = { name: '', category: 'Food', default_check_number: '', contact: '', phone: '', email: '', notes: '', is_active: true }

function num(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(String(value ?? '').replace(/[$,%(),]/g, '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}
function money(value) { return `$${num(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function normalizeItemName(value) {
  return String(value || '').toLowerCase().replace(/\b(case|cs|pack|pk|bottle|btl|box|bag|each|ea)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}
function itemUnitCost(row) {
  const qty = num(row.quantity ?? row.qty ?? row.case_qty ?? row.pack_qty) || 1
  const explicit = num(row.unit_cost ?? row.unitCost ?? row.price_each)
  if (explicit) return explicit
  const total = num(row.line_total ?? row.total ?? row.amount ?? row.extended_cost)
  return total / qty
}
function itemSize(row) { return row.size || row.unit_size || row.package_size || row.pack_size || row.uom || row.unit || '-' }

const categoryIconMap = {
  food: 'utensils', beer: 'beer', beverage: 'beverage', beverages: 'beverage', liquor: 'wine', wine: 'wine',
  insurance: 'shield', maintenance: 'wrench', supplies: 'package', utilities: 'zap', accounting: 'business',
  loan: 'landmark', marketing: 'megaphone', other: 'ellipsis'
}
const categoryColorMap = {
  food: 'cat-food', beer: 'cat-beer', beverage: 'cat-beverage', beverages: 'cat-beverage', liquor: 'cat-liquor', wine: 'cat-liquor',
  insurance: 'cat-insurance', maintenance: 'cat-maintenance', supplies: 'cat-supplies', utilities: 'cat-utilities',
  accounting: 'cat-accounting', loan: 'cat-loan', marketing: 'cat-marketing', other: 'cat-other'
}
function categoryMeta(name) {
  const key = String(name || '').toLowerCase().trim()
  return { icon: categoryIconMap[key] || 'ellipsis', cls: categoryColorMap[key] || 'cat-other' }
}

export default function Vendors({ data, setData }) {
  const vendors = useMemo(() => {
    const merged = new Map()
    const addVendor = (name, seed = {}) => {
      const cleanName = String(name || '').trim()
      if (!cleanName) return
      const key = normalizeVendorName(cleanName) || cleanName.toLowerCase()
      const current = merged.get(key)
      if (current) {
        merged.set(key, { ...seed, ...current, name: current.name || cleanName })
        return
      }
      merged.set(key, {
        id: seed.id || `linked-vendor:${key}`,
        name: cleanName,
        category: seed.category || 'Other',
        default_check_number: seed.default_check_number || '',
        contact: seed.contact || '', phone: seed.phone || '', email: seed.email || '',
        notes: seed.notes || 'Referenced by saved purchasing records',
        is_active: seed.is_active !== false,
        linked_only: !seed.id,
        ...seed,
      })
    }
    ;(data.vendors || []).forEach(vendor => addVendor(vendor.name, vendor))
    ;(data.invoices || []).forEach(invoice => addVendor(invoice.vendor_name || invoice.vendor, { category: invoice.category || 'Other', linked_only: true }))
    ;(data.invoiceItems || []).forEach(item => addVendor(item.vendor_name || item.vendor, { category: item.category || 'Other', linked_only: true }))
    ;(data.expenses || []).forEach(expense => addVendor(expense.vendor_name || expense.vendor, { category: expense.category || 'Other', linked_only: true }))
    return sortByName([...merged.values()])
  }, [data.vendors, data.invoices, data.invoiceItems, data.expenses])
  const categories = data.vendorCategories || ['Food', 'Beverage', 'Beer', 'Liquor', 'Utilities', 'Insurance', 'Supplies', 'Maintenance', 'Other']
  const [form, setForm] = useState(blankVendor)
  const [editingId, setEditingId] = useState(null)
  const [newCategory, setNewCategory] = useState('')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkCategory, setBulkCategory] = useState('Food')
  const [status, setStatus] = useState('Local auto-save is active. Vendor data stays on this computer until Supabase sync is added.')
  const [activeFilter, setActiveFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mergePrimaryId, setMergePrimaryId] = useState('')
  const [mergeDuplicateId, setMergeDuplicateId] = useState('')

  const filtered = useMemo(() => vendors
    .filter(v => activeFilter === 'all' ? true : activeFilter === 'active' ? v.is_active !== false : v.is_active === false)
    .filter(v => categoryFilter === 'all' ? true : String(v.category || '') === categoryFilter)
    .filter(v => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return [v.name, v.category, v.default_check_number, v.contact, v.phone, v.email, v.notes].join(' ').toLowerCase().includes(q)
    }), [vendors, search, activeFilter, categoryFilter])


  const duplicateSuggestions = useMemo(() => {
    const results = []
    for (let i = 0; i < vendors.length; i += 1) {
      for (let j = i + 1; j < vendors.length; j += 1) {
        const score = vendorSimilarity(vendors[i].name, vendors[j].name)
        if (score >= 0.68) results.push({ a: vendors[i], b: vendors[j], score })
      }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, 8)
  }, [vendors])

  const mergeSummary = useMemo(() => {
    const duplicate = vendors.find(v => v.id === mergeDuplicateId)
    if (!duplicate) return null
    const invoices = (data.invoices || []).filter(row => row.vendor_id === duplicate.id || normalizeVendorName(row.vendor_name) === normalizeVendorName(duplicate.name)).length
    const invoiceIds = new Set((data.invoices || []).filter(row => row.vendor_id === duplicate.id || normalizeVendorName(row.vendor_name) === normalizeVendorName(duplicate.name)).map(row => row.id))
    const items = (data.invoiceItems || []).filter(row => invoiceIds.has(row.invoice_id)).length
    const expenses = (data.expenses || []).filter(row => row.vendor_id === duplicate.id || normalizeVendorName(row.vendor || row.vendor_name) === normalizeVendorName(duplicate.name)).length
    return { invoices, items, expenses }
  }, [vendors, mergeDuplicateId, data.invoices, data.invoiceItems, data.expenses])

  function mergeVendors() {
    if (!mergePrimaryId || !mergeDuplicateId || mergePrimaryId === mergeDuplicateId) return setStatus('Choose two different vendors to merge')
    const primary = vendors.find(v => v.id === mergePrimaryId)
    const duplicate = vendors.find(v => v.id === mergeDuplicateId)
    if (!primary || !duplicate) return setStatus('Vendor selection is invalid')
    const summary = mergeSummary || { invoices: 0, items: 0, expenses: 0 }
    if (!window.confirm(`Merge ${duplicate.name} into ${primary.name}? This will reassign ${summary.invoices} invoices, ${summary.items} invoice items, and ${summary.expenses} expenses. The duplicate vendor will be removed.`)) return
    setData(prev => {
      const invoiceIds = new Set((prev.invoices || []).filter(row => row.vendor_id === duplicate.id || normalizeVendorName(row.vendor_name) === normalizeVendorName(duplicate.name)).map(row => row.id))
      return {
        ...prev,
        vendors: (prev.vendors || []).filter(v => v.id !== duplicate.id),
        invoices: (prev.invoices || []).map(row => invoiceIds.has(row.id) ? { ...row, vendor_id: primary.id, vendor_name: primary.name } : row),
        invoiceItems: (prev.invoiceItems || []).map(row => invoiceIds.has(row.invoice_id) ? { ...row, vendor_id: primary.id, vendor_name: primary.name } : row),
        expenses: (prev.expenses || []).map(row => row.vendor_id === duplicate.id || normalizeVendorName(row.vendor || row.vendor_name) === normalizeVendorName(duplicate.name)
          ? { ...row, vendor_id: primary.id, vendor: primary.name, vendor_name: primary.name }
          : row)
      }
    })
    setMergeDuplicateId('')
    setStatus(`Merged ${duplicate.name} into ${primary.name}`)
  }

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function clearForm() {
    setForm(blankVendor)
    setEditingId(null)
  }

  function saveVendor() {
    const name = form.name.trim()
    if (!name) return setStatus('Enter vendor name first')
    const possibleMatch = vendors
      .filter(v => v.id !== editingId)
      .map(v => ({ vendor: v, score: vendorSimilarity(v.name, name) }))
      .sort((a, b) => b.score - a.score)[0]
    if (!editingId && possibleMatch?.score >= 0.82) {
      setMergePrimaryId(possibleMatch.vendor.id)
      setStatus(`Possible duplicate vendor: ${possibleMatch.vendor.name}. Edit that vendor or use Merge Vendors below.`)
      return
    }
    const vendorPayload = { ...blankVendor, ...form, name, normalized_name: normalizeVendorName(name), updated_at: new Date().toISOString() }
    setData(prev => {
      const current = prev.vendors || []
      if (editingId) {
        const exists = current.some(v => v.id === editingId)
        if (!exists) return { ...prev, vendors: sortByName([...current, { ...vendorPayload, id: editingId, created_at: new Date().toISOString() }]) }
        return { ...prev, vendors: sortByName(current.map(v => v.id === editingId ? { ...v, ...vendorPayload, id: editingId } : v)) }
      }
      const vendor = { ...vendorPayload, id: createId('ven'), created_at: new Date().toISOString() }
      return { ...prev, vendors: sortByName([...current, vendor]) }
    })
    setStatus(editingId ? `Vendor updated locally: ${name}` : `Vendor saved locally: ${name}`)
    clearForm()
  }

  function editVendor(vendor) {
    if (!vendor?.id) return setStatus('This vendor is missing an ID and cannot be edited. Delete and recreate it.')
    setEditingId(vendor.id)
    setForm({ ...blankVendor, ...vendor })
    setStatus(`Editing vendor: ${vendor.name}`)
    requestAnimationFrame(() => document.querySelector('.employee-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function deleteVendor(id) {
    setData(prev => ({ ...prev, vendors: (prev.vendors || []).filter(v => v.id !== id) }))
    setSelectedIds(prev => prev.filter(item => item !== id))
    if (editingId === id) clearForm()
    setStatus('Vendor deleted locally')
  }

  function toggleSelected(id) { setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]) }
  function toggleAllFiltered(checked) { setSelectedIds(checked ? filtered.map(v => v.id) : []) }
  function bulkDelete() {
    if (!selectedIds.length) return setStatus('Select vendors first')
    setData(prev => ({ ...prev, vendors: (prev.vendors || []).filter(v => !selectedIds.includes(v.id)) }))
    setStatus(`Deleted ${selectedIds.length} selected vendors`)
    setSelectedIds([])
  }
  function bulkSetActive(isActive) {
    if (!selectedIds.length) return setStatus('Select vendors first')
    setData(prev => ({ ...prev, vendors: (prev.vendors || []).map(v => selectedIds.includes(v.id) ? { ...v, is_active: isActive } : v) }))
    setStatus(`Updated ${selectedIds.length} selected vendors`)
  }
  function bulkApplyCategory() {
    if (!selectedIds.length) return setStatus('Select vendors first')
    setData(prev => ({ ...prev, vendors: (prev.vendors || []).map(v => selectedIds.includes(v.id) ? { ...v, category: bulkCategory } : v) }))
    setStatus(`Applied ${bulkCategory} to ${selectedIds.length} vendors`)
  }

  function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    if (categories.some(c => c.toLowerCase() === name.toLowerCase())) return setStatus('Category already exists')
    setData(prev => ({ ...prev, vendorCategories: [...(prev.vendorCategories || []), name].sort((a, b) => a.localeCompare(b)) }))
    setNewCategory('')
    setStatus(`Vendor category saved locally: ${name}`)
  }

  function deleteCategory(name) {
    setData(prev => ({ ...prev, vendorCategories: (prev.vendorCategories || []).filter(c => c !== name) }))
    setStatus('Vendor category removed locally')
  }

  return <>
    <div className="page-head employee-head single-toolbar-head">
      <div className="employee-head-actions">
        <div className="search-box"><Icon name="search" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." /></div>
        <select className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">All Categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select className="filter-select" value={activeFilter} onChange={e => setActiveFilter(e.target.value)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
    </div>
    <div className="status-pill">{status}</div>

    <section className="form-card tight-card employee-form-card">
      <h2>{editingId ? 'Edit Vendor — changes update the same row' : 'Add New Vendor'}</h2>
      <div className="employee-form-grid vendor-form-grid">
        <label>Vendor name <span>*</span><input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Vendor name" /></label>
        <label>Category <span>*</span><select value={form.category} onChange={e => update('category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>Default Check # / Account<input value={form.default_check_number || ''} onChange={e => update('default_check_number', e.target.value)} placeholder="Optional check/account ref" /></label>
        <label>Contact<input value={form.contact} onChange={e => update('contact', e.target.value)} placeholder="Contact person" /></label>
        <label>Phone<input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="Phone" /></label>
        <label>Email<input value={form.email} onChange={e => update('email', e.target.value)} placeholder="Email" /></label>
        <label className="wide-2">Notes<input value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Notes, account number, delivery info" /></label>
        <label className="check-line vendor-active"><input type="checkbox" checked={form.is_active} onChange={e => update('is_active', e.target.checked)} /> Active vendor</label>
      </div>
      <div className="type-manager-grid compact-types">
        <div className="type-box">
          <h3>Vendor Categories</h3>
          <div className="mini-add-row"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Add category" /><button onClick={addCategory} type="button">Add</button></div>
          <div className="chip-row">{categories.map(c => { const meta = categoryMeta(c); return <button key={c} className={`chip category-chip ${meta.cls}`} type="button" onClick={() => deleteCategory(c)} title="Click to remove category"><Icon name={meta.icon} size={15} /> <span>{c}</span><Icon name="x" size={13} /></button> })}</div>
        </div>
      </div>
      <div className="form-action-footer"><button className="btn secondary" type="button" onClick={clearForm}>{editingId ? 'Cancel Edit' : 'Clear'}</button><button className="btn primary" type="button" onClick={saveVendor}><Icon name="save" /> {editingId ? 'Update Vendor' : 'Save Vendor'}</button></div>
    </section>


    <section className="table-card vendor-merge-card" id="vendor-merge">
      <header><div><h2>Vendor Duplicate Review & Merge</h2><p>Prevent US Foods, U.S. Foods, Performance Foodservice, PFG, and similar names from creating separate vendor histories.</p></div><Icon name="merge" size={22} /></header>
      <div className="vendor-merge-grid">
        <label>Keep as primary vendor<select value={mergePrimaryId} onChange={e => setMergePrimaryId(e.target.value)}><option value="">Select primary</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <label>Merge duplicate vendor<select value={mergeDuplicateId} onChange={e => setMergeDuplicateId(e.target.value)}><option value="">Select duplicate</option>{vendors.filter(v => v.id !== mergePrimaryId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
        <div className="vendor-merge-summary">{mergeSummary ? <><b>Records to reassign</b><br />{mergeSummary.invoices} invoices · {mergeSummary.items} line items · {mergeSummary.expenses} expenses</> : <>Select a duplicate to preview affected records.</>}</div>
        <button type="button" className="btn primary" onClick={mergeVendors}><Icon name="merge" /> Merge Vendors</button>
      </div>
      {duplicateSuggestions.length > 0 && <div className="chip-row">{duplicateSuggestions.map(item => <button type="button" className="chip" key={`${item.a.id}-${item.b.id}`} onClick={() => { setMergePrimaryId(item.a.id); setMergeDuplicateId(item.b.id) }}>{item.a.name} ↔ {item.b.name} · {Math.round(item.score * 100)}%</button>)}</div>}
    </section>

    <section className="table-card compact-table-card employee-table-card">
      <header><h2>Vendor List</h2><div className="vendor-list-header-actions"><span>{filtered.length} shown of {vendors.length} · Sorted A-Z</span><button type="button" className="small-btn" onClick={() => { setSearch(''); setActiveFilter('all'); setCategoryFilter('all') }}>Show All</button></div></header>
      {selectedIds.length > 0 && <div className="bulk-bar"><b>{selectedIds.length} selected</b><button type="button" onClick={() => bulkSetActive(true)}>Set Active</button><button type="button" onClick={() => bulkSetActive(false)}>Set Inactive</button><select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select><button onClick={bulkApplyCategory} type="button">Apply Category</button><button className="delete-link" onClick={bulkDelete} type="button">Delete Selected</button></div>}
      <div className="vendor-list-scroll"><table><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && filtered.every(v => selectedIds.includes(v.id))} onChange={e => toggleAllFiltered(e.target.checked)} /></th><th>Name</th><th>Category</th><th>Default Check #</th><th>Contact</th><th>Phone</th><th>Email</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(v => <tr key={v.id}>
        <td><input type="checkbox" checked={selectedIds.includes(v.id)} onChange={() => toggleSelected(v.id)} /></td>
        <td><b>{v.name}</b><small>{v.linked_only ? 'Referenced by saved purchasing records — edit to create a full vendor record' : (v.notes || 'No notes')}</small></td>
        <td>{(() => { const meta = categoryMeta(v.category); return <span className={`tag category-tag ${meta.cls}`}><Icon name={meta.icon} size={13} /> {v.category}</span> })()}</td>
        <td>{v.default_check_number || '-'}</td>
        <td>{v.contact || '-'}</td>
        <td>{v.phone || '-'}</td>
        <td>{v.email || '-'}</td>
        <td><span className={v.is_active ? 'tag cash' : 'tag neutral'}>{v.is_active ? 'Active' : 'Inactive'}</span></td>
        <td className="row-actions"><button type="button" onClick={() => editVendor(v)}>Edit</button><button className="delete-link" type="button" onClick={() => deleteVendor(v.id)}>Delete</button></td>
      </tr>)}{!filtered.length && <tr><td colSpan="9" className="empty-cell">No vendors match the current filters. Press Show All to reset the list.</td></tr>}</tbody></table></div>
    </section>
  </>
}
