import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function today() { return new Date().toISOString().slice(0, 10) }
function money(value) { return Number(value || 0).toFixed(2) }
function num(value) { return Number(String(value ?? '').replace(/[$,]/g, '')) || 0 }
function rowDate(row) { return row.date || row.expense_date || row.created_at?.slice(0, 10) || today() }
function inRange(row, start, end) {
  const d = rowDate(row)
  if (start && d < start) return false
  if (end && d > end) return false
  return true
}
const blankExpense = { date: today(), name: '', category: 'Restaurant Expenses', amount: '', payment_method: 'Cash', vendor: '', notes: '' }

export default function Expenses({ data, setData }) {
  const categories = data.expenseCategories || []
  const paymentMethods = data.paymentMethods || ['Cash', 'Check', 'Credit', 'ACH']
  const [form, setForm] = useState(blankExpense)
  const [editingId, setEditingId] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [selected, setSelected] = useState([])

  const expenses = data.expenses || []
  const filtered = useMemo(() => expenses
    .filter(row => inRange(row, dateStart, dateEnd))
    .filter(row => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return [row.name, row.category, row.vendor, row.payment_method, row.notes].some(v => String(v || '').toLowerCase().includes(q))
    })
    .sort((a, b) => rowDate(b).localeCompare(rowDate(a)) || String(a.name || '').localeCompare(String(b.name || ''))), [expenses, search, dateStart, dateEnd])

  const summary = useMemo(() => {
    const total = filtered.reduce((sum, row) => sum + num(row.amount), 0)
    const cash = filtered.filter(row => row.payment_method === 'Cash').reduce((sum, row) => sum + num(row.amount), 0)
    const check = filtered.filter(row => row.payment_method === 'Check').reduce((sum, row) => sum + num(row.amount), 0)
    const credit = filtered.filter(row => row.payment_method === 'Credit').reduce((sum, row) => sum + num(row.amount), 0)
    const ach = filtered.filter(row => row.payment_method === 'ACH').reduce((sum, row) => sum + num(row.amount), 0)
    return { total, cash, check, credit, ach }
  }, [filtered])

  function updateForm(key, value) { setForm(prev => ({ ...prev, [key]: value })) }
  function clearForm() { setForm(blankExpense); setEditingId('') }
  function addCategory() {
    const value = newCategory.trim()
    if (!value || categories.includes(value)) return
    setData(prev => ({ ...prev, expenseCategories: [...(prev.expenseCategories || []), value].sort((a, b) => a.localeCompare(b)) }))
    setForm(prev => ({ ...prev, category: value }))
    setNewCategory('')
  }
  function saveExpense() {
    if (!form.name.trim() && !form.category) return
    const record = { ...form, id: editingId || createId('expense'), amount: num(form.amount), date: form.date || today(), updated_at: new Date().toISOString() }
    setData(prev => ({
      ...prev,
      expenses: editingId ? (prev.expenses || []).map(row => row.id === editingId ? record : row) : [record, ...(prev.expenses || [])]
    }))
    clearForm()
  }
  function editExpense(row) {
    setEditingId(row.id)
    setForm({ date: row.date || today(), name: row.name || '', category: row.category || categories[0] || 'Other', amount: row.amount || '', payment_method: row.payment_method || 'Cash', vendor: row.vendor || '', notes: row.notes || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function deleteExpense(id) { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => row.id !== id) })); setSelected(prev => prev.filter(x => x !== id)) }
  function toggleAll() { setSelected(prev => prev.length === filtered.length ? [] : filtered.map(row => row.id)) }
  function toggleOne(id) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function bulkDelete() { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => !selected.includes(row.id)) })); setSelected([]) }

  return <>
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
        <label><small>Category</small><select value={form.category} onChange={e => updateForm('category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></label>
        <label><small>Amount</small><input type="number" step="0.01" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="0.00" /></label>
        <label><small>Paid By</small><select value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></label>
        <label><small>Vendor / Payee</small><input value={form.vendor} onChange={e => updateForm('vendor', e.target.value)} placeholder="Vendor or payee" /></label>
        <label className="wide-2"><small>Notes</small><input value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Optional notes" /></label>
        <div className="form-actions-inline"><button className="btn primary" onClick={saveExpense}><Icon name="plus" /> {editingId ? 'Update' : 'Add Expense'}</button><button className="btn ghost" onClick={clearForm}>Clear</button></div>
      </div>
      <div className="mini-add-row expense-category-row">
        <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Add expense category" />
        <button className="btn ghost small-btn" onClick={addCategory}>Add Category</button>
      </div>
      <div className="chip-row">{categories.map(cat => <button key={cat} className={`chip ${form.category === cat ? 'selected' : ''}`} onClick={() => updateForm('category', cat)}>{cat}</button>)}</div>
    </section>

    <div className="sales-filter-bar report-filter-bar">
      <label className="date-range-field"><span>Start</span><input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} /></label>
      <span className="range-arrow">→</span>
      <label className="date-range-field"><span>End</span><input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></label>
      <button className="btn ghost" onClick={() => { setDateStart(''); setDateEnd('') }}>All Dates</button>
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
      <table className="sales-table"><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /></th><th>Date</th><th>Name</th><th>Category</th><th>Paid By</th><th>Vendor</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} /></td><td>{rowDate(row)}</td><td><b>{row.name || row.category}</b></td><td><span className="tag neutral">{row.category}</span></td><td><span className={`tag ${String(row.payment_method || '').toLowerCase()}`}>{row.payment_method}</span></td><td>{row.vendor || '-'}</td><td>${money(row.amount)}</td><td><small>{row.notes || '-'}</small></td><td className="row-actions"><button className="btn ghost small-btn" onClick={() => editExpense(row)}>Edit</button><button className="btn ghost small-btn delete-link" onClick={() => deleteExpense(row.id)}>Delete</button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan="9"><small>No expenses found. Add an expense above.</small></td></tr>}
      </tbody></table>
    </section>
  </>
}
