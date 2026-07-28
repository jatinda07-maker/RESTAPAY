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
  const [payeeMode, setPayeeMode] = useState('vendor')
  const [search, setSearch] = useState('')
  const [dateStart, setDateStart] = useState(() => readPageDateRange('expenses').start)
  const [dateEnd, setDateEnd] = useState(() => readPageDateRange('expenses').end)
  const [selected, setSelected] = useState([])
  const [recoveryStatus, setRecoveryStatus] = useState('')

  const filteredVendorOptions = useMemo(() => filterVendors(vendors, ''), [vendors])

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
    setPayeeMode(matchedVendor ? 'vendor' : 'payee')
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

  return <div className="expenses-rc5-page">
    <section className="expense-entry-card">
      <header className="expense-entry-header">
        <div className="expense-title-wrap">
          <span className="expense-title-icon"><Icon name="expenses" size={22} /></span>
          <div>
            <h2>{editingId ? 'Edit Expense' : 'Add Expense'} <span className="expense-saved-badge"><Icon name="shield" size={14} /> {expenses.length} saved</span></h2>
            <p>Track and manage business expenses</p>
          </div>
        </div>
      </header>

      <div className="expense-form-grid">
        <label><small>Date</small><span className="field-with-icon blue"><Icon name="calendar" size={17} /><input type="date" value={form.date} onChange={e => updateForm('date', e.target.value)} /></span></label>
        <label><small>Expense Name <em>*</em></small><span className="field-with-icon green"><Icon name="receipt" size={17} /><input value={form.name} onChange={e => updateForm('name', e.target.value)} placeholder="Electric bill, accounting fee..." /></span></label>
        <label><small>Vendor Category <em>*</em></small><span className="field-with-icon orange"><Icon name="package" size={17} /><select value={form.category} onChange={e => updateForm('category', e.target.value)}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></span></label>
        <label><small>Amount <em>*</em></small><span className="field-with-icon green"><Icon name="dollar" size={17} /><input type="number" step="0.01" value={form.amount} onChange={e => updateForm('amount', e.target.value)} placeholder="0.00" /></span></label>
        <label><small>Paid By <em>*</em></small><span className="field-with-icon purple"><Icon name="card" size={17} /><select value={form.payment_method} onChange={e => updateForm('payment_method', e.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></span></label>
        <label><small>Check # / Ref</small><span className="field-with-icon blue"><Icon name="receipt" size={17} /><input value={form.check_number} onChange={e => updateForm('check_number', e.target.value)} placeholder="Check number" /></span></label>

        <label className="expense-payee-field"><small>Vendor / Payee <em>*</em></small>
          <div className="vendor-payee-combo">
            <div className="vendor-payee-tabs" role="group" aria-label="Vendor or payee type">
              <button
                type="button"
                className={payeeMode === 'vendor' ? 'active vendor' : ''}
                onClick={() => { setPayeeMode('vendor'); setForm(prev => ({ ...prev, manual_payee: '', vendor: '', vendor_id: '' })) }}
              ><Icon name="store" size={15} /> Vendor</button>
              <button
                type="button"
                className={payeeMode === 'payee' ? 'active payee' : ''}
                onClick={() => { setPayeeMode('payee'); setForm(prev => ({ ...prev, vendor_id: '', vendor: prev.manual_payee || '', manual_payee: prev.manual_payee || '' })) }}
              ><Icon name="person" size={15} /> Payee</button>
            </div>
            <div className="vendor-payee-control">
              {payeeMode === 'payee' ? (
                <><Icon name="person" size={16} /><input value={form.manual_payee || ''} onChange={e => updateManualPayee(e.target.value)} placeholder="Enter one-time payee" /></>
              ) : (
                <><Icon name="store" size={16} /><select value={form.vendor_id || ''} onChange={e => selectVendor(e.target.value)}>
                  <option value="">Select saved vendor</option>
                  {filteredVendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}{vendor.category ? ` — ${vendor.category}` : ''}</option>)}
                </select></>
              )}
            </div>
          </div>
        </label>

        <label className="expense-notes-field"><small>Notes</small><span className="field-with-icon orange"><Icon name="receipt" size={17} /><input value={form.notes} onChange={e => updateForm('notes', e.target.value)} placeholder="Optional notes" /></span></label>
        <div className="form-actions-inline"><button className="btn primary" onClick={saveExpense} type="button"><Icon name="plus" /> {editingId ? 'Update Expense' : 'Add Expense'}</button><button className="btn secondary-dark" onClick={clearForm} type="button"><Icon name="refresh" size={16} /> Clear</button></div>
      </div>
    </section>

    <div className="page-filter-shell">
      <div className="search-box sales-search"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses, payee, category..." /></div>
      <DateControls start={dateStart} end={dateEnd} onStartChange={setDateStart} onEndChange={setDateEnd} onApply={applyDateRange} onPreset={applyPreset} />
      <span className="filter-note">Filtering expenses by {rangeLabel}</span>
      <button className="btn secondary" onClick={recoverMissingExpenses} type="button">Recover Missing Expenses</button>
      {selected.length > 0 && <button className="btn ghost delete-link" onClick={bulkDelete} type="button">Delete Selected ({selected.length})</button>}
    </div>

    {recoveryStatus ? <div className="status-pill">{recoveryStatus}</div> : null}

    <div className="payroll-summary-row sales-summary-row stat-row-clean">
      <div><span>Total Expenses</span><b>${money(summary.total)}</b></div>
      <div><span>Cash</span><b>${money(summary.cash)}</b></div>
      <div><span>Check / Credit</span><b>${money(summary.check + summary.credit)}</b></div>
      <div><span>ACH</span><b>${money(summary.ach)}</b></div>
    </div>

    <section className="table-card compact-table-card sales-history-card">
      <header className="table-header-actions"><h2>Expenses <span className="inline-count">{filtered.length} rows</span></h2><div className="search-box compact-search"><Icon name="search" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." /></div></header>
      <div className="table-scroll"><table className="sales-table"><thead><tr><th><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleAll} /></th><th>Date</th><th>Name</th><th>Category</th><th>Paid By</th><th>Check #</th><th>Vendor</th><th>Amount</th><th>Notes</th><th>Actions</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.id}><td><input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} /></td><td>{rowDate(row)}</td><td><b>{row.name || row.category}</b></td><td><span className="tag neutral">{row.category}</span></td><td><span className={`tag ${String(row.payment_method || '').toLowerCase()}`}>{row.payment_method}</span></td><td>{row.check_number || '-'}</td><td>{row.vendor || '-'}</td><td>${money(row.amount)}</td><td><small>{row.notes || '-'}</small></td><td className="row-actions"><button className="btn ghost small-btn" type="button" onClick={() => editExpense(row)}>Edit</button><button className="btn ghost small-btn delete-link" type="button" onClick={() => deleteExpense(row.id)}>Delete</button></td></tr>)}
        {filtered.length === 0 && <tr><td colSpan="10"><small>No expenses found. Add an expense above.</small></td></tr>}
      </tbody></table></div>
    </section>
  </div>
}
