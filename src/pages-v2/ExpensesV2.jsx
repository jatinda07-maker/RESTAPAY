import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import UploadBar from '../components/UploadBar'
import { createId } from '../lib/localStore'

const PAGE_SIZE = 10
const today = () => new Date().toISOString().slice(0, 10)
const money = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const EMPTY = { date: today(), name: '', category: 'Supplies', payment_method: 'Cash', check_number: '', amount: '', vendor: '', vendor_id: '', notes: '' }

export default function ExpensesV2({ data, setData }) {
  const expenses = data.expenses || []
  const vendors = data.vendors || []
  const categories = data.vendorCategories?.length ? data.vendorCategories : ['Food','Beverage','Beer','Liquor','Supplies','Utilities','Maintenance','Insurance','Other']
  const paymentMethods = data.paymentMethods?.length ? data.paymentMethods : ['Cash','Check','Credit Card','ACH','Auto']
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [payment, setPayment] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...expenses]
      .sort((a,b) => String(b.date || b.expense_date || '').localeCompare(String(a.date || a.expense_date || '')))
      .filter(row => {
        const rowPayment = row.payment_method || row.payment_type || 'Cash'
        return (!q || `${row.name} ${row.vendor} ${row.category} ${row.notes} ${row.check_number}`.toLowerCase().includes(q))
          && (category === 'all' || row.category === category)
          && (payment === 'all' || rowPayment === payment)
      })
  }, [expenses, search, category, payment])

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    const by = method => expenses.filter(row => String(row.payment_method || row.payment_type || '').toLowerCase() === method.toLowerCase()).reduce((sum,row) => sum + Number(row.amount || 0), 0)
    return { count: expenses.length, total, cash: by('Cash'), check: by('Check'), other: total - by('Cash') - by('Check') }
  }, [expenses])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const openAdd = () => { setEditingId(null); setForm({...EMPTY, date: today()}); setModalOpen(true) }
  const openEdit = row => {
    setEditingId(row.id)
    setForm({ ...EMPTY, ...row, date: row.date || row.expense_date || today(), payment_method: row.payment_method || row.payment_type || 'Cash' })
    setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm(EMPTY) }
  const updateVendor = id => {
    const vendor = vendors.find(item => item.id === id)
    setForm(prev => ({ ...prev, vendor_id: id, vendor: vendor?.name || '', category: vendor?.category || prev.category, check_number: vendor?.default_check_number || prev.check_number }))
  }

  function saveExpense(event) {
    event.preventDefault()
    if (!form.name.trim() && !form.vendor.trim()) { setNotice('Expense name or vendor is required.'); return }
    if (!Number(form.amount || 0)) { setNotice('Expense amount is required.'); return }
    const record = { ...form, name: form.name.trim() || form.vendor.trim(), amount: Number(form.amount || 0), updated_at: new Date().toISOString() }
    setData(prev => ({ ...prev, expenses: editingId ? (prev.expenses || []).map(row => row.id === editingId ? {...row, ...record, id: editingId} : row) : [{...record, id: createId('expense')}, ...(prev.expenses || [])] }))
    setNotice(editingId ? 'Expense updated.' : 'Expense added.')
    closeModal()
  }

  function deleteExpense(row) {
    if (!window.confirm(`Delete ${row.name || row.vendor || 'this expense'}?`)) return
    setData(prev => ({...prev, expenses: (prev.expenses || []).filter(item => item.id !== row.id)}))
    setNotice('Expense deleted.')
  }

  function clearFilters() { setSearch(''); setCategory('all'); setPayment('all'); setPage(1) }
  function handleUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setNotice(`${file.name} selected. Review the extracted expense before saving.`)
    event.target.value = ''
  }

  const cards = [
    ['receipt','Total Expenses',stats.count,'purple'],
    ['calendar','This Month',money(stats.total),'green'],
    ['dollar','Cash',money(stats.cash),'orange'],
    ['card','Check',money(stats.check),'pink'],
    ['wallet','Other',money(stats.other),'blue']
  ]

  return <div className="rv2-page rv2-entity-v2 rv2-expenses-v2"><div className="rv2-mock-page rv2-expenses-mock">
    <div className="rv2-mock-action-row"><UploadBar label="Upload Expense" accept=".pdf,.png,.jpg,.jpeg,.csv,.xls,.xlsx" onChange={handleUpload}/><button className="rv2-orange-button" onClick={openAdd}><Icon name="plus" size={16}/> Add Expense</button></div>
    {notice && <div className="rv2-inline-notice" role="status">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <div className="rv2-stat-grid rv2-stat-grid-five">{cards.map(([icon,label,value,tone]) => <div className={`rv2-stat-card tone-${tone}`} key={label}><div className="rv2-stat-label"><span><Icon name={icon} size={13}/></span>{label}</div><strong>{value}</strong></div>)}</div>
    <section className="rv2-data-panel">
      <div className="rv2-filter-row"><label className="rv2-search-control"><Icon name="search" size={16}/><input value={search} onChange={e => {setSearch(e.target.value);setPage(1)}} placeholder="Search expenses..."/></label><select value={category} onChange={e => {setCategory(e.target.value);setPage(1)}}><option value="all">All Categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><select value={payment} onChange={e => {setPayment(e.target.value);setPage(1)}}><option value="all">All Payment Types</option>{paymentMethods.map(item => <option key={item}>{item}</option>)}</select><button className="rv2-clear-button" onClick={clearFilters}>Clear Filters</button></div>
      <div className="rv2-table-scroll"><table className="rv2-mock-table"><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Payment</th><th>Check #</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{visible.length ? visible.map(row => <tr key={row.id}><td>{row.date || row.expense_date || '—'}</td><td><strong>{row.name || row.vendor || '—'}</strong>{row.vendor && row.vendor !== row.name ? <small className="rv2-cell-subtext">{row.vendor}</small> : null}</td><td><span className="rv2-badge category-badge">{row.category || 'Other'}</span></td><td><span className={`rv2-badge method-${String(row.payment_method || row.payment_type || 'cash').toLowerCase().replace(/\s+/g,'-')}`}>{row.payment_method || row.payment_type || 'Cash'}</span></td><td>{row.check_number || '—'}</td><td><strong>{money(row.amount)}</strong></td><td><div className="rv2-row-icon-actions"><button title="Edit expense" onClick={() => openEdit(row)}><Icon name="edit" size={15}/></button><button className="danger" title="Delete expense" onClick={() => deleteExpense(row)}><Icon name="trash" size={15}/></button></div></td></tr>) : <tr><td colSpan="7" className="rv2-empty-row">No expenses match the selected filters.</td></tr>}</tbody></table></div>
      <div className="rv2-table-footer"><div>Show <select value={PAGE_SIZE} disabled><option>{PAGE_SIZE}</option></select> entries</div><div className="rv2-pagination"><button disabled={currentPage <= 1} onClick={() => setPage(value => Math.max(1,value-1))}>‹</button>{Array.from({length: totalPages},(_,index) => index+1).slice(0,5).map(number => <button key={number} className={currentPage === number ? 'is-active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button disabled={currentPage >= totalPages} onClick={() => setPage(value => Math.min(totalPages,value+1))}>›</button></div></div>
    </section>
    {modalOpen && <div className="rv2-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeModal()}><section className="rv2-form-modal rv2-form-modal-compact" role="dialog" aria-modal="true"><header><div className="rv2-modal-title"><span><Icon name="expenses" size={22}/></span><div><h2>{editingId ? 'Edit Expense' : 'Add Expense'}</h2><p>Enter the expense, payment method, and vendor details.</p></div></div><button className="rv2-modal-close" onClick={closeModal}><Icon name="x" size={18}/></button></header><form onSubmit={saveExpense}><div className="rv2-form-grid rv2-popup-scroll">
      <label>Date<input type="date" value={form.date} onChange={e => setForm({...form,date:e.target.value})}/></label><label>Expense Name<input autoFocus value={form.name} onChange={e => setForm({...form,name:e.target.value})} placeholder="Expense description"/></label>
      <label>Vendor<select value={form.vendor_id || ''} onChange={e => updateVendor(e.target.value)}><option value="">Manual payee</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label><label>Manual Payee<input value={form.vendor || ''} onChange={e => setForm({...form,vendor:e.target.value,vendor_id:''})} placeholder="Vendor or payee"/></label>
      <label>Category<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label>Payment Type<select value={form.payment_method} onChange={e => setForm({...form,payment_method:e.target.value})}>{paymentMethods.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Check Number<input value={form.check_number || ''} onChange={e => setForm({...form,check_number:e.target.value})} placeholder="Optional"/></label><label>Amount<input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({...form,amount:e.target.value})} placeholder="0.00"/></label>
      <label className="span-2">Notes<textarea value={form.notes || ''} onChange={e => setForm({...form,notes:e.target.value})} placeholder="Additional notes"/></label>
    </div><footer><button className="rv2-clear-button" type="button" onClick={closeModal}>Cancel</button><button className="rv2-orange-button" type="submit"><Icon name="save" size={16}/>{editingId ? 'Update Expense' : 'Save Expense'}</button></footer></form></section></div>}
  </div></div>
}
