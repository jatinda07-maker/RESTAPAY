import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import DateControls from '../components/DateControls'
import { createId, loadCloudData, retryPendingCloudSave, saveCloudData } from '../lib/localStore'
import { filterVendors, findVendorById, findVendorByName, getActiveSortedVendors } from '../engine/VendorEngine'
import { applyPresetToSetters, isDateInRange, makeRangeLabel, readPageDateRange, savePageDateRange, todayISO } from '../engine/DateEngine'

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
  const [payeeMode, setPayeeMode] = useState('vendor')
  const [recoveryStatus, setRecoveryStatus] = useState('')


  const filteredVendorOptions = vendors


  const expenses = data.expenses || []
  const filtered = useMemo(() => expenses
    .filter(row => isDateInRange(rowDate(row), dateStart, dateEnd))
    .filter(row => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return [row.name, row.category, row.vendor, row.payment_method, row.check_number, row.notes].some(v => String(v || '').toLowerCase().includes(q))
    })
    .sort((a, b) => rowDate(a).localeCompare(rowDate(b)) || String(a.vendor || a.name || '').localeCompare(String(b.vendor || b.name || ''))), [expenses, search, dateStart, dateEnd])

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

  function applyPreset(preset) {
    applyPresetToSetters(preset, setDateStart, setDateEnd, (start, end) => savePageDateRange('expenses', start, end))
  }

  const rangeLabel = makeRangeLabel(dateStart, dateEnd)

  function clearForm() { setForm({ ...blankExpense, category: categories[0] || 'Food' }); setEditingId(''); setPayeeMode('vendor') }


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
      date: row.date || row.expense_date || today(),
      name: row.name || '',
      category: categories.includes(row.category) ? row.category : (categories[0] || 'Food'),
      amount: row.amount || '',
      payment_method: row.payment_method || row.payment_type || 'Cash',
      check_number: row.check_number || '',
      vendor: row.vendor || matchedVendor?.name || '',
      vendor_id: matchedVendor?.id || '',
      manual_payee: matchedVendor ? '' : (row.vendor || ''),
      notes: row.notes || ''
    })
    setPayeeMode(matchedVendor ? 'vendor' : 'payee')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function deleteExpense(id) { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => row.id !== id) })); setSelected(prev => prev.filter(x => x !== id)) }
  function toggleAll() { setSelected(prev => prev.length === filtered.length ? [] : filtered.map(row => row.id)) }
  function toggleOne(id) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function bulkDelete() { setData(prev => ({ ...prev, expenses: (prev.expenses || []).filter(row => !selected.includes(row.id)) })); setSelected([]) }

  async function recoverMissingExpenses() {
    setRecoveryStatus('Checking local and Supabase recovery copies...')
    try {
      await retryPendingCloudSave()
      const recovered = await loadCloudData()
      if (!recovered) {
        setRecoveryStatus('No recovery data could be loaded. Existing records were not changed.')
        return
      }
      const before = (data.expenses || []).length
      const after = (recovered.expenses || []).length
      setData(recovered)
      const result = await saveCloudData(recovered, { source: 'expense-recovery' })
      if (result?.ok) {
        setRecoveryStatus(after > before ? `Recovered ${after - before} missing expense entr${after - before === 1 ? 'y' : 'ies'} and saved to Supabase.` : `Recovery check completed. ${after} expense records are stored.`)
      } else {
        setRecoveryStatus(`Recovered data locally, but Supabase still needs attention: ${result?.error?.message || result?.reason || 'save failed'}`)
      }
    } catch (error) {
      console.error(error)
      setRecoveryStatus(`Recovery failed: ${error?.message || String(error)}`)
    }
  }

  return <main className="expenses-rc5-page">
    <section className="expense-entry-card">
      <div className="expense-entry-header">
        <div>
          <span className="expense-eyebrow">Expense workspace</span>
          <h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2>
          <p>Record purchases, bills and one-time payments without leaving the page.</p>
        </div>
        <span className="expense-saved-badge"><Icon name="receipt" size={15} /> {expenses.length} saved</span>
      </div>

      <div className="expense-entry-grid">
        <label className="expense-field">
          <span><Icon name="calendar" size={15} /> Date</span>
          <input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} />
        </label>
        <label className="expense-field expense-field-wide">
          <span><Icon name="receipt" size={15} /> Expense name</span>
          <input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Electric bill, accounting fee..." />
        </label>
        <label className="expense-field">
          <span><Icon name="package" size={15} /> Category</span>
          <select value={form.category} onChange={e => updateForm('category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select>
        </label>
        <label className="expense-field">
          <span><Icon name="dollar" size={15} /> Amount</span>
          <input type="number" step="0.01" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="0.00" />
        </label>
        <label className="expense-field">
          <span><Icon name="card" size={15} /> Paid by</span>
          <select value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select>
        </label>
        <label className="expense-field">
          <span><Icon name="landmark" size={15} /> Check # / Ref</span>
          <input value={form.check_number} onChange={e => updateForm('check_number', e.target.value)} placeholder="Optional reference" />
        </label>

        <div className="expense-field expense-payee-field">
          <span><Icon name="store" size={15} /> Vendor / Payee</span>
          <div className="expense-payee-control">
            <div className="expense-payee-toggle" role="tablist" aria-label="Vendor or payee">
              <button type="button" className={payeeMode === 'vendor' ? 'active' : ''} onClick={() => { setPayeeMode('vendor'); updateManualPayee('') }}>Vendor</button>
              <button type="button" className={payeeMode === 'payee' ? 'active' : ''} onClick={() => { setPayeeMode('payee'); selectVendor('__manual__') }}>Payee</button>
            </div>
            {payeeMode === 'vendor' ? (
              <select value={form.vendor_id || ''} onChange={e => selectVendor(e.target.value)}>
                <option value="">Select saved vendor</option>
                {filteredVendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.category ? ` — ${vendor.category}` : ''}</option>)}
              </select>
            ) : (
              <input value={form.manual_payee || ''} onChange={e => updateManualPayee(e.target.value)} placeholder="Enter one-time payee" />
            )}
          </div>
        </div>

        <label className="expense-field expense-notes-field">
          <span><Icon name="edit" size={15} /> Notes</span>
          <input value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Optional notes" />
        </label>

        <div className="expense-entry-actions">
          <button className="btn primary" onClick={saveExpense} type="button"><Icon name={editingId ? 'save' : 'plus'} size={17} /> {editingId ? 'Update Expense' : 'Add Expense'}</button>
          <button className="btn neutral" onClick={clearForm} type="button">Clear</button>
        </div>
      </div>
    </section>

    <section className="expense-filter-card">
      <div className="expense-filter-topline">
        <div className="search-box expense-main-search"><Icon name="search" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses, vendor, category or reference..." /></div>
        <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={applyDateRange} onPreset={applyPreset} />
        <button className="btn secondary" onClick={recoverMissingExpenses} type="button"><Icon name="refresh" size={16} /> Recover</button>
        {selected.length > 0 && <button className="btn danger" onClick={bulkDelete} type="button"><Icon name="trash" size={16} /> Delete ({selected.length})</button>}
      </div>
      <span className="filter-note">Showing expenses for {rangeLabel}</span>
    </section>

    {recoveryStatus ? <div className="status-pill">{recoveryStatus}</div> : null}

    <section className="expense-kpi-grid">
      <article className="expense-kpi total"><span className="expense-kpi-icon"><Icon name="expenses" /></span><div><small>Total Expenses</small><strong>${money(summary.total)}</strong><span>{filtered.length} transactions</span></div></article>
      <article className="expense-kpi cash"><span className="expense-kpi-icon"><Icon name="dollar" /></span><div><small>Cash</small><strong>${money(summary.cash)}</strong><span>Cash payments</span></div></article>
      <article className="expense-kpi card"><span className="expense-kpi-icon"><Icon name="card" /></span><div><small>Check / Credit</small><strong>${money(summary.check + summary.credit)}</strong><span>Bank and card payments</span></div></article>
      <article className="expense-kpi ach"><span className="expense-kpi-icon"><Icon name="landmark" /></span><div><small>ACH</small><strong>${money(summary.ach)}</strong><span>Electronic transfers</span></div></article>
    </section>

    <section className="table-card compact-table-card expense-table-card">
      <header className="table-header-actions"><div><span className="expense-eyebrow">Expense register</span><h2>Expenses <span className="inline-count">{filtered.length} rows</span></h2></div></header>
      <div className="table-scroll"><table className="sales-table"><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /></th><th>Date</th><th>Name</th><th>Category</th><th>Paid By</th><th>Check #</th><th>Vendor / Payee</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} /></td><td>{rowDate(row)}</td><td><b>{row.name || row.category}</b></td><td><span className="tag neutral">{row.category}</span></td><td><span className={`tag ${String(row.payment_method || '').toLowerCase()}`}>{row.payment_method}</span></td><td>{row.check_number || '-'}</td><td>{row.vendor || '-'}</td><td className="expense-amount-cell">${money(row.amount)}</td><td><small>{row.notes || '-'}</small></td><td className="row-actions"><button className="btn ghost small-btn" type="button" onClick={() => editExpense(row)}><Icon name="edit" size={14} /> Edit</button><button className="btn ghost small-btn delete-link" type="button" onClick={() => deleteExpense(row.id)}><Icon name="trash" size={14} /> Delete</button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan="10"><div className="expense-empty"><Icon name="receipt" size={30} /><b>No expenses found</b><small>Add an expense above or change the selected date range.</small></div></td></tr>}
      </tbody></table></div>
    </section>
  </main>
}
