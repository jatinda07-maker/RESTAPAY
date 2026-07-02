import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'
import { filterVendors, findVendorById, findVendorByName, getActiveSortedVendors } from '../engine/VendorEngine'
import { isDateInRange, makeRangeLabel, readPageDateRange, savePageDateRange, startOfMonthISO, todayISO } from '../engine/DateEngine'

function today() { return todayISO() }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) { return Number(String(value ?? '').replace(/[$,]/g, '')) || 0 }
function rowDate(row) { return row.date || row.expense_date || row.created_at?.slice(0, 10) || today() }
const blankExpense = { date: today(), name: '', category: 'Food', amount: '', payment_method: 'Cash', check_number: '', vendor: '', vendor_id: '', manual_payee: '', notes: '' }

export default function Expenses({ data, setData }) {
  const categories = (data.vendorCategories?.length ? data.vendorCategories : ['Food', 'Beverage', 'Beer', 'Liquor', 'Utilities', 'Insurance', 'Supplies', 'Maintenance', 'Other']).slice().sort((a, b) => a.localeCompare(b))
  const paymentMethods = data.paymentMethods || ['Cash', 'Check', 'Credit', 'ACH']
  const vendors = getActiveSortedVendors(data.vendors || [])
  const [form, setForm] = useState(blankExpense)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState(() => readPageDateRange('expenses').start)
  const [dateEnd, setDateEnd] = useState(() => readPageDateRange('expenses').end)
  const [selected, setSelected] = useState([])
  const [vendorSearch, setVendorSearch] = useState('')

  const filteredVendorOptions = useMemo(() => {
    const q = vendorSearch.toLowerCase().trim()
    return filterVendors(vendors, q)
  }, [vendors, vendorSearch])

  const expenses = data.expenses || []
  const filtered = useMemo(() => expenses
    .filter(row => isDateInRange(rowDate(row), dateStart, dateEnd))
    .filter(row => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return [row.name, row.category, row.vendor, row.payment_method, row.check_number, row.notes].some(v => String(v || '').toLowerCase().includes(q))
    })
    .sort((a, b) => rowDate(b).localeCompare(rowDate(a)) || String(a.vendor || a.name || '').localeCompare(String(b.vendor || b.name || ''))), [expenses, search, dateStart, dateEnd])

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, row) => sum + num(row.amount), 0)
    const cash = filtered.filter(row => row.payment_method === 'Cash').reduce((sum, row) => sum + num(row.amount), 0)
    const check = filtered.filter(row => row.payment_method === 'Check').reduce((sum, row) => sum + num(row.amount), 0)
    const credit = filtered.filter(row => row.payment_method === 'Credit').reduce((sum, row) => sum + num(row.amount), 0)
    const ach = filtered.filter(row => row.payment_method === 'ACH').reduce((sum, row) => sum + num(row.amount), 0)
    return { total, cash, check, credit, ach }
  }, [filtered])

  function updateForm(key, value) { setForm(prev => ({ ...prev, [key]: value })) }

  function selectVendor(vendorId) {
    if (vendorId === '__manual__') {
      setForm(prev => ({ ...prev, vendor_id: '', vendor: prev.manual_payee || '', manual_payee: prev.manual_payee || '' }))
      return
    }

    const vendor = findVendorById(vendors, vendorId)
    if (!vendor) {
      setForm(prev => ({ ...prev, vendor_id: '', vendor: '', manual_payee: '' }))
      return
    }

    setForm(prev => ({
      ...prev,
      vendor_id: vendor.id,
      vendor: vendor.name,
      manual_payee: '',
      category: vendor.category || prev.category,
      check_number: vendor.default_check_number || prev.check_number
    }))
  }

  function updateManualPayee(value) {
    setForm(prev => ({ ...prev, manual_payee: value, vendor: value, vendor_id: '' }))
  }

  function applyDateRange() {
    savePageDateRange('expenses', dateStart, dateEnd)
  }

  function setThisMonth() {
    const start = startOfMonthISO()
    const end = todayISO()
    setDateStart(start)
    setDateEnd(end)
    savePageDateRange('expenses', start, end)
  }

  function setAllDates() {
    setDateStart('')
    setDateEnd('')
    savePageDateRange('expenses', '', '')
  }

  const rangeLabel = makeRangeLabel(dateStart, dateEnd)

  function clearForm() { setForm({ ...blankExpense, category: categories[0] || 'Food' }); setEditingId(''); setVendorSearch('') }


  function saveExpense() {
    const vendorName = form.vendor_id ? (vendors.find(v => v.id === form.vendor_id)?.name || form.vendor) : (form.manual_payee || form.vendor)
    const expenseName = form.name.trim() || vendorName || form.category
    if (!expenseName && !form.category) return

    const record = {
      ...form,
      id: editingId || createId('expense'),
      name: expenseName,
      vendor: vendorName,
      vendor_id: form.vendor_id || '',
      manual_payee: form.vendor_id ? '' : (form.manual_payee || ''),
      amount: num(form.amount),
      date: form.date || today(),
      updated_at: new Date().toISOString()
    }

    setData(prev => ({
      ...prev,
      expenses: editingId ? (prev.expenses || []).map(row => row.id === editingId ? record : row) : [record, ...(prev.expenses || [])]
    }))
    clearForm()
  }

  function editExpense(row) {
    setEditingId(row.id)
    const matchedVendor = findVendorById(vendors, row.vendor_id) || findVendorByName(vendors, row.vendor)
    setForm({
      date: row.date || today(),
      name: row.name || '',
      category: categories.includes(row.category) ? row.category : (categories[0] || 'Food'),
      amount: row.amount || '',
      payment_method: row.payment_method || 'Cash',
      check_number: row.check_number || '',
      vendor: row.vendor || matchedVendor?.name || '',
      vendor_id: matchedVendor?.id || '',
      manual_payee: matchedVendor ? '' : (row.vendor || ''),
      notes: row.notes || ''
    })
    setVendorSearch('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteExpense(id) { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => row.id !== id) })); setSelected(prev => prev.filter(x => x !== id)) }
  function toggleAll() { setSelected(prev => prev.length === filtered.length ? [] : filtered.map(row => row.id)) }
  function toggleOne(id) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function bulkDelete() { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => !selected.includes(row.id)) })); setSelected([]) }

  return <>
    <style>{`
      .expense-form-grid {
        display: grid;
        grid-template-columns: 180px 180px 180px 170px 170px 170px 210px 180px minmax(220px, 1fr) 160px;
        gap: 10px;
        align-items: end;
      }
      .expense-form-grid label {
        min-width: 0;
        display: grid;
        gap: 5px;
      }
      .expense-form-grid label small {
        min-height: 16px;
        line-height: 16px;
        white-space: nowrap;
      }
      .expense-form-grid input,
      .expense-form-grid select {
        width: 100%;
        min-width: 0;
      }
      .expense-form-grid .wide-2 {
        grid-column: auto;
      }
      .expense-form-grid .form-actions-inline {
        display: flex;
        gap: 8px;
        align-items: end;
        justify-content: flex-end;
        align-self: end;
      }
      .expense-form-grid .form-actions-inline .btn {
        height: 42px;
        white-space: nowrap;
      }
      @media (max-width: 1500px) {
        .expense-form-grid {
          grid-template-columns: repeat(5, minmax(160px, 1fr));
        }
        .expense-form-grid .wide-2 {
          grid-column: span 2;
        }
        .expense-form-grid .form-actions-inline {
          justify-content: flex-start;
        }
      }
      @media (max-width: 900px) {
        .expense-form-grid {
          grid-template-columns: repeat(2, minmax(150px, 1fr));
        }
        .expense-form-grid .wide-2 {
          grid-column: span 2;
        }
      }
    `}</style>


    <div className="page-head employee-head">
      <div><h1>Expenses Workspace</h1><p>Track restaurant expenses, loans, accounting fees, utilities, supplies, maintenance, insurance, cash expenses and more.</p></div>
      <div className="employee-head-actions">
        <div className="search-box"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." /></div>
      </div>
    </div>

    <section className="card employee-form-card tight-card">
      <header><h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2><span>{expenses.length} saved</span></header>
      <div className="expense-form-grid">
        <label><small>Date</small><input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} /></label>
        <label><small>Expense Name</small><input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Electric bill, accounting fee..." /></label>
        <label><small>Vendor Category</small><select value={form.category} onChange={e => updateForm('category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></label>
        <label><small>Amount</small><input type="number" step="0.01" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="0.00" /></label>
        <label><small>Paid By</small><select value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></label>
        <label><small>Check # / Ref</small><input value={form.check_number} onChange={e => updateForm('check_number', e.target.value)} placeholder="Check number" /></label>

        <label><small>Find Vendor / Payee</small><input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} placeholder="Type to search active vendors..." /></label>
        <label><small>Vendor / Payee</small>
          <select value={form.vendor_id || (form.manual_payee ? '__manual__' : '')} onChange={e => selectVendor(e.target.value)}>
            <option value="">Select active vendor</option>
            {filteredVendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.category ? ` — ${vendor.category}` : ''}</option>)}
            <option value="__manual__">Manual Payee / One-time</option>
          </select>
        </label>

        {!form.vendor_id && <label><small>Manual Payee</small><input value={form.manual_payee || ''} onChange={e => updateManualPayee(e.target.value)} placeholder="Type payee name" /></label>}

        <label className="wide-2"><small>Notes</small><input value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Optional notes" /></label>
        <div className="form-actions-inline"><button className="btn primary" onClick={saveExpense}><Icon name="plus" /> {editingId ? 'Update' : 'Add Expense'}</button><button className="btn ghost" onClick={clearForm}>Clear</button></div>
      </div>
    </section>

    <div className="sales-filter-bar report-filter-bar">
      <label className="date-range-field"><span>Start</span><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} /></label>
      <span className="range-arrow">→</span>
      <label className="date-range-field"><span>End</span><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></label>
      <button className="btn primary" onClick={applyDateRange}>Apply Date Range</button>
      <button className="btn ghost" onClick={setThisMonth}>This Month</button>
      <button className="btn ghost" onClick={setAllDates}>All Dates</button>
      <span className="filter-note">Filtering expenses by {rangeLabel}</span>
      {selected.length > 0 && <button className="btn ghost delete-link" onClick={bulkDelete}>Delete Selected ({selected.length})</button>}
    </div>

    <div className="payroll-summary-row sales-summary-row">
      <div><span>Total Expenses</span><b>${money(summary.total)}</b></div>
      <div><span>Cash</span><b>${money(summary.cash)}</b></div>
      <div><span>Check / Credit</span><b>${money(summary.check + summary.credit)}</b></div>
      <div><span>ACH</span><b>${money(summary.ach)}</b></div>
    </div>

    <section className="table-card compact-table-card sales-history-card">
      <header><h2>Expenses</h2><span>{filtered.length} rows</span></header>
      <table className="sales-table"><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /></th><th>Date</th><th>Name</th><th>Category</th><th>Paid By</th><th>Check #</th><th>Vendor</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} /></td><td>{rowDate(row)}</td><td><b>{row.name || row.category}</b></td><td><span className="tag neutral">{row.category}</span></td><td><span className={`tag ${String(row.payment_method || '').toLowerCase()}`}>{row.payment_method}</span></td><td>{row.check_number || '-'}</td><td>{row.vendor || '-'}</td><td>${money(row.amount)}</td><td><small>{row.notes || '-'}</small></td><td className="row-actions"><button className="btn ghost small-btn" onClick={() => editExpense(row)}>Edit</button><button className="btn ghost small-btn delete-link" onClick={() => deleteExpense(row.id)}>Delete</button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan="10"><small>No expenses found. Add an expense above.</small></td></tr>}
      </tbody></table>
    </section>
  </>
}
