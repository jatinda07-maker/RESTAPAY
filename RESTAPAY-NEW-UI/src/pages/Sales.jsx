import { useMemo, useState } from 'react'
import { BadgeDollarSign, Banknote, ChevronDown, ChevronLeft, ChevronRight, CreditCard, Download, Filter, Gift, Pencil, Plus, Search, Trash2, Upload, WalletCards } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import DetailDrawer from '../components/DetailDrawer'
import Modal from '../components/Modal'
import ToastReportImport from '../components/ToastReportImport'
import usePersistentState from '../hooks/usePersistentState'
import { useFeedback } from '../components/AppFeedback'
import { SALES_TABS, salesViewRows, summarizeSales } from '../core/engines/SalesViewEngine.js'

const blankSale = { date: '', category: 'Food', payment: 'Cash', amount: '', tips: '', source: 'Manual Entry', location: 'Jaybos Restaurant' }
const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
const isoToDisplay = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value || ''
}
const displayToIso = (value) => {
  const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return match ? `${match[3]}-${match[1]}-${match[2]}` : value || ''
}

export default function Sales() {
  const { notify } = useFeedback()
  const [rows, setRows] = usePersistentState('restapay.sales', [])
  const [query, setQuery] = useState('')
  const [payment, setPayment] = useState('All Payments')
  const [location, setLocation] = useState('All Locations')
  const [tab, setTab] = useState('All Sales')
  const [openCard, setOpenCard] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(blankSale)
  const [toastImportOpen, setToastImportOpen] = useState(false)

  const filteredRows = useMemo(() => salesViewRows(rows, { tab, payment, query, location }), [rows, tab, payment, query, location])
  const totals = useMemo(() => summarizeSales(rows), [rows])
  const currentTotal = useMemo(() => filteredRows.reduce((sum, row) => sum + Number(row.view_amount || 0), 0), [filteredRows])

  const summaryCards = [
    { title: 'Net Sales', value: money(totals.net), meta: `${rows.length} daily sales entries`, tone: 'blue', icon: BadgeDollarSign },
    { title: 'Cash Sales', value: money(totals.cash), meta: 'Actual cash payments', tone: 'green', icon: Banknote },
    { title: 'Credit Sales', value: money(totals.credit), meta: 'Card and debit payments', tone: 'teal', icon: CreditCard },
    { title: 'Other Sales', value: money(totals.other), meta: 'Gift, delivery and other', tone: 'orange', icon: Gift },
    { title: 'Tips Earned', value: money(totals.tips), meta: 'Excluded from operating profit', tone: 'purple', icon: WalletCards },
  ]

  const openAdd = () => { setEditingId(null); setForm(blankSale); setModalOpen(true) }
  const openEdit = (row) => {
    setEditingId(row.id)
    setForm({
      ...blankSale,
      ...row,
      date: isoToDisplay(row.business_date || row.date),
      category: row.category || row.view_category || 'Food',
      payment: row.payment || (Number(row.cash_sales) ? 'Cash' : Number(row.credit_sales) ? 'Credit' : 'Other'),
      amount: Number(row.amount ?? row.net_sales ?? 0),
      tips: Number(row.tips_collected ?? row.tips ?? 0),
    })
    setModalOpen(true)
  }
  const saveSale = () => {
    if (!form.date || form.amount === '') return notify('Date and amount are required.', 'error')
    const amount = Number(form.amount || 0)
    const tips = Number(form.tips || 0)
    const businessDate = displayToIso(form.date)
    const normalized = {
      ...form,
      business_date: businessDate,
      date: businessDate,
      amount,
      net_sales: amount,
      gross_sales: amount,
      tips,
      tips_collected: tips,
      food_sales: form.category === 'Food' ? amount : 0,
      alcohol_sales: form.category === 'Alcohol' ? amount : 0,
      other_sales: form.category === 'Other' ? amount : 0,
      cash_sales: form.payment === 'Cash' ? amount : 0,
      credit_sales: form.payment === 'Credit' ? amount : 0,
      other_payments: form.payment === 'Other' ? amount : 0,
      gift_card_sales: 0,
      source_file: form.source_file || '',
    }
    if (editingId) setRows(items => items.map(item => item.id === editingId ? { ...item, ...normalized, id: editingId } : item))
    else setRows(items => [{ ...normalized, id: `manual-sale-${Date.now()}` }, ...items])
    setModalOpen(false)
    notify(editingId ? 'Sale updated.' : 'Sale added.')
  }
  const deleteSale = (row) => {
    if (!window.confirm(`Delete the sales record for ${row.view_date || row.date}?`)) return
    setRows(items => items.filter(item => item.id !== row.id))
    notify('Sale deleted.', 'info')
  }
  const exportCsv = () => {
    const header = ['Date', 'View', 'Category', 'Amount', 'Tips', 'Food Sales', 'Alcohol Sales', 'Cash', 'Credit', 'Gift Card', 'Other', 'Tax', 'Source']
    const csvRows = filteredRows.map(row => [row.view_date, tab, row.view_category, row.view_amount, row.view_tips, row.food_sales || 0, row.alcohol_sales || 0, row.cash_sales || 0, row.credit_sales || 0, row.gift_card_sales || 0, row.other_payments || 0, row.tax || 0, row.source_file || row.source])
    const csv = [header, ...csvRows].map(r => r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `restapay-sales-${tab.toLowerCase().replaceAll(' ', '-')}.csv`; a.click(); URL.revokeObjectURL(url)
    notify(`${tab} CSV exported.`)
  }
  const importSales = ({ rows: importedRows }) => {
    const normalized = importedRows.map((row, index) => ({
      ...row,
      id: row.id || `toast-sale-${Date.now()}-${index}`,
      business_date: row.business_date || row.date || new Date().toISOString().slice(0, 10),
      date: row.business_date || row.date || new Date().toISOString().slice(0, 10),
      category: Number(row.alcohol_sales || 0) > 0 && Number(row.food_sales || 0) > 0 ? 'Food + Alcohol' : Number(row.alcohol_sales || 0) > 0 ? 'Alcohol' : Number(row.food_sales || 0) > 0 ? 'Food' : 'Other',
      payment: 'Mixed',
      amount: Number(row.net_sales || row.amount || 0),
      tips: Number(row.tips_collected ?? row.tips ?? 0),
      source: 'Toast POS',
      location: row.location || 'Jaybos Restaurant',
    })).filter(row => Number(row.amount) || Number(row.tips) || Number(row.cash_sales) || Number(row.credit_sales) || Number(row.other_payments))
    if (!normalized.length) return notify('No recognizable Toast sales rows were found.', 'error')
    const sourceFile = normalized[0]?.source_file
    setRows(items => {
      const withoutSameFile = sourceFile ? items.filter(item => item.source_file !== sourceFile) : items
      return [...normalized, ...withoutSameFile]
    })
    notify(`${normalized.length} Toast daily sales records imported with payment and department breakdowns.`)
  }

  const amountHeading = tab === 'All Sales' ? 'Net Sales' : tab === 'Tips' ? 'Tips Amount' : `${tab} Amount`

  return <div className="sales-page">
    <DateToolbar />
    <section className="sales-summary-grid">{summaryCards.map(({ title, value, meta, tone, icon: Icon }) => <button key={title} type="button" className={`sales-summary-card sales-tone-${tone}`} onClick={() => setOpenCard(title)}><span className="sales-summary-icon"><Icon size={22} strokeWidth={1.9}/></span><span className="sales-summary-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight size={18} className="sales-summary-arrow"/></button>)}</section>
    <section className="sales-workspace card-surface">
      <header className="sales-workspace-header"><div><h2>Sales Activity</h2><p>Daily Toast sales with separate payment, department, tax, and tip totals</p></div><div className="sales-header-actions"><button type="button" className="secondary-action sales-action" onClick={() => setToastImportOpen(true)}><Upload size={17}/>Import Toast Report</button><button type="button" className="secondary-action sales-action" onClick={exportCsv}><Download size={17}/>Export</button><button type="button" className="primary-button sales-add" onClick={openAdd}><Plus size={17}/>Add Sale</button></div></header>
      <nav className="sales-tabs" aria-label="Sales sections">{SALES_TABS.map(item => <button key={item} type="button" className={tab === item ? 'active' : ''} onClick={() => { setTab(item); if (item !== 'All Sales') setPayment('All Payments') }}>{item}<span>{money(item === 'All Sales' ? totals.net : item === 'Cash' ? totals.cash : item === 'Credit' ? totals.credit : item === 'Other' ? totals.other : totals.tips)}</span></button>)}</nav>
      <div className="sales-filterbar"><label className="sales-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search dates, categories, source..."/></label><label className="sales-select"><Filter size={16}/><select value={payment} onChange={e => setPayment(e.target.value)}><option>All Payments</option><option>Cash</option><option>Credit</option><option>Other</option></select><ChevronDown size={14}/></label><label className="sales-select"><select value={location} onChange={e => setLocation(e.target.value)}><option>All Locations</option><option>Jaybos Restaurant</option></select><ChevronDown size={14}/></label></div>
      <div className="sales-view-summary"><span><strong>{tab}</strong> view</span><b>{money(currentTotal)}</b><small>{filteredRows.length} daily records</small></div>
      <div className="sales-table-wrap"><table className="sales-table"><thead><tr><th>Date</th><th>Department</th><th>View Type</th><th>{amountHeading}</th><th>{tab === 'Tips' ? 'Net Sales' : 'Tips'}</th><th>Source</th><th>Actions</th></tr></thead><tbody>{filteredRows.length ? filteredRows.map(row => <tr key={row.id}><td>{isoToDisplay(row.view_date)}</td><td><strong>{row.view_category}</strong><small className="sales-row-subline">Food {money(row.food_sales)} · Alcohol {money(row.alcohol_sales)}</small></td><td><span className={`payment-badge payment-${String(row.view_payment).toLowerCase().replaceAll(' ', '-')}`}>{row.view_payment}</span></td><td>{money(row.view_amount)}</td><td>{money(tab === 'Tips' ? row.net_sales : row.view_tips)}</td><td><span>{row.source || 'Toast POS'}</span><small className="sales-row-subline">{row.source_file || 'Manual entry'}</small></td><td><div className="row-actions"><button type="button" aria-label="Edit sale" onClick={() => openEdit(row)}><Pencil size={15}/></button><button type="button" aria-label="Delete sale" className="danger" onClick={() => deleteSale(row)}><Trash2 size={15}/></button></div></td></tr>) : <tr><td colSpan="7"><div className="sales-empty">No {tab.toLowerCase()} records match the current filters.</div></td></tr>}</tbody></table></div>
      <footer className="sales-table-footer"><span>Showing {filteredRows.length} of {rows.length} daily sales entries</span><div className="sales-pagination"><button type="button" aria-label="Previous page" onClick={() => notify('You are on the first page.', 'info')}><ChevronLeft size={16}/></button><button type="button" className="active">1</button><button type="button" aria-label="Next page" onClick={() => notify('All matching records are displayed.', 'info')}><ChevronRight size={16}/></button></div></footer>
    </section>
    <Modal open={modalOpen} title={editingId ? 'Edit Sale' : 'Add Sale'} subtitle="Enter a sales record and payment details" onClose={() => setModalOpen(false)} footer={<><button className="secondary-action" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" onClick={saveSale}>{editingId ? 'Save Changes' : 'Add Sale'}</button></>}><div className="form-grid"><label>Date<input type="date" value={displayToIso(form.date)} onChange={e => setForm(f => ({ ...f, date: isoToDisplay(e.target.value) }))}/></label><label>Category<select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}><option>Food</option><option>Alcohol</option><option>Other</option></select></label><label>Payment Type<select value={form.payment} onChange={e => setForm(f => ({ ...f, payment: e.target.value }))}><option>Cash</option><option>Credit</option><option>Other</option></select></label><label>Amount<input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00"/></label><label>Tips<input type="number" step="0.01" value={form.tips} onChange={e => setForm(f => ({ ...f, tips: e.target.value }))} placeholder="0.00"/></label><label>Source<input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}/></label></div></Modal>
    <ToastReportImport open={toastImportOpen} type="sales" onClose={() => setToastImportOpen(false)} onImport={importSales}/>
    <DetailDrawer title={openCard} onClose={() => setOpenCard(null)}/>
  </div>
}
