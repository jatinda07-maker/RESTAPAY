import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Download, Expand, Minimize2, Printer, Save, X } from 'lucide-react'
import { useFeedback } from './AppFeedback'
import { useNavigate } from 'react-router-dom'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import useGlobalDateRange, { presetDates, readDateRange } from '../hooks/useGlobalDateRange'


const rowsTotal = (rows, field = 'amount') => rows.reduce((sum,row) => sum + (Number(row[field] ?? row.total ?? 0) || 0), 0)
const salesCategory = (rows, pattern) => rows.filter(row => pattern.test(String(row.category || row.department || ''))).reduce((sum,row)=>sum+(Number(row.amount||0)||0),0)
const formatRangeDate = value => { if (!value) return '—'; const [y,m,d] = String(value).split('-').map(Number); const date = y&&m&&d ? new Date(y,m-1,d) : new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}) }

function buildDrawerContent(title, { metrics, sales, invoices, expenses, payroll, vendors, employees }) {
  const tone = /cost|expense|alcohol/i.test(title || '') ? 'orange' : /profit|cash|food/i.test(title || '') ? 'green' : /vendor|payroll|labor|employee/i.test(title || '') ? 'purple' : 'blue'
  const salesRows = [['Food Sales','Food department',appMoney(metrics.foodSales)],['Alcohol Sales','Beer, wine and liquor',appMoney(metrics.alcoholSales)],['Other Sales','Other categories',appMoney(metrics.otherSales)]]
  const paymentRows = [['Cash Sales','Cash payments',appMoney(metrics.cashSales)],['Credit Sales','Card payments',appMoney(metrics.creditSales)],['Tips','Excluded from profit',appMoney(metrics.tips)]]
  const costRows = [['Food Cost',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['Alcohol Cost',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['Labor Cost',`${payroll.length} payroll records`,appMoney(metrics.payrollTotal)]]
  const map = {
    'Net Sales': ['Sales by category and payment type', [{title:'Sales by Category',rows:salesRows,total:['Net Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Payments',appMoney(metrics.salesTotal)]}]],
    'Cash Sales': ['Actual cash sales and payments', [{title:'Cash Activity',rows:[['Cash Sales',`${sales.filter(r=>String(r.payment||'').toLowerCase()==='cash').length} entries`,appMoney(metrics.cashSales)]],total:['Cash Sales',appMoney(metrics.cashSales)]}]],
    'Credit Sales': ['Card and debit activity', [{title:'Credit Activity',rows:[['Credit Sales',`${sales.filter(r=>/credit|card/i.test(String(r.payment||''))).length} entries`,appMoney(metrics.creditSales)]],total:['Credit Sales',appMoney(metrics.creditSales)]}]],
    'Other Sales': ['Other payment activity', [{title:'Other Activity',rows:[['Other Sales','Delivery and other',appMoney(metrics.otherSales)]],total:['Other Sales',appMoney(metrics.otherSales)]}]],
    'Tips Earned': ['Customer tips kept separate from profit', [{title:'Tip Activity',rows:[['Tips',`${sales.length} sales records`,appMoney(metrics.tips)]],total:['Tips Earned',appMoney(metrics.tips)]}]],
    'Sales Summary': ['Detailed breakdown of sales', [{title:'Sales Breakdown',rows:salesRows,total:['Total Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Total Payments',appMoney(metrics.salesTotal)]}]],
    'Cost Breakdown': ['Food, alcohol, labor and prime cost', [{title:'Current Period Costs',rows:costRows,total:['Prime Cost',appMoney(metrics.primeCostAmount)]}]],
    'Profit Summary': ['Income, deductions and operating profit', [{title:'Profit Detail',rows:[['Gross Sales','Before expenses',appMoney(metrics.salesTotal)],['Cost of Goods','Food and alcohol',appMoney(-metrics.cogs)],['Payroll & Expenses','Labor and operating',appMoney(-(metrics.payrollTotal+metrics.expenseTotal))]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Vendor Spend': ['Vendor invoice totals and recent activity', [{title:'Top Vendors',rows:(metrics.topVendors.length?metrics.topVendors:[['No vendor data',0]]).map(([name,value])=>[name,'Invoice spend',appMoney(value)]),total:['Vendor Total',appMoney(metrics.invoiceTotal)]}]],
    'Food Cost': ['Food purchases compared with food sales', [{title:'Food Cost',rows:[['Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['Food Sales','Matching sales',appMoney(metrics.foodSales)],['True Food Cost','Purchases ÷ sales',appPercent(metrics.foodCostPercent)]],total:['Food Cost',appMoney(metrics.foodCost)]}]],
    'True Food Cost': ['Food purchases compared with food sales', [{title:'True Food Cost',rows:[['Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['Food Sales','Matching sales',appMoney(metrics.foodSales)]],total:['True Food Cost',appPercent(metrics.foodCostPercent)]}]],
    'Alcohol Cost': ['Alcohol purchases compared with alcohol sales', [{title:'Alcohol Cost',rows:[['Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['Alcohol Sales','Matching sales',appMoney(metrics.alcoholSales)],['True Alcohol Cost','Purchases ÷ sales',appPercent(metrics.alcoholCostPercent)]],total:['Alcohol Cost',appMoney(metrics.alcoholCost)]}]],
    'True Alcohol Cost': ['Alcohol purchases compared with alcohol sales', [{title:'True Alcohol Cost',rows:[['Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['Alcohol Sales','Matching sales',appMoney(metrics.alcoholSales)]],total:['True Alcohol Cost',appPercent(metrics.alcoholCostPercent)]}]],
    'Food Invoices': ['Food invoices in the selected period', [{title:'Food Invoices',rows:[['Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Food Invoice Total',appMoney(metrics.foodCost)]}]],
    'Alcohol Invoices': ['Alcohol invoices in the selected period', [{title:'Alcohol Invoices',rows:[['Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Alcohol Invoice Total',appMoney(metrics.alcoholCost)]}]],
    'Payroll Total': ['Payroll, tips and payment methods', [{title:'Payroll Summary',rows:[['Cash Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').length} entries`,appMoney(metrics.cashPayroll)],['Check Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='check').length} entries`,appMoney(metrics.checkPayroll)],['Total Hours','Imported and manual labor',metrics.payrollHours.toFixed(1)]],total:['Payroll Total',appMoney(metrics.payrollTotal)]}]],
    'Cash Payroll': ['Cash payment employees', [{title:'Cash Payroll',rows:[['Cash Payroll','Current records',appMoney(metrics.cashPayroll)]],total:['Cash Payroll',appMoney(metrics.cashPayroll)]}]],
    'Check Payroll': ['Check payment employees', [{title:'Check Payroll',rows:[['Check Payroll','Current records',appMoney(metrics.checkPayroll)]],total:['Check Payroll',appMoney(metrics.checkPayroll)]}]],
    'Total Expenses': ['Operating expense totals', [{title:'Expenses',rows:[['All Expenses',`${expenses.length} records`,appMoney(metrics.expenseTotal)],['Cash Expenses','Cash payments',appMoney(metrics.cashExpenses)]],total:['Total Expenses',appMoney(metrics.expenseTotal)]}]],
    'Invoice Total': ['Invoice totals and status', [{title:'Invoices',rows:[['All Invoices',`${invoices.length} records`,appMoney(metrics.invoiceTotal)]],total:['Invoice Total',appMoney(metrics.invoiceTotal)]}]],
    'Active Employees': ['Current employee records', [{title:'Employees',rows:[['Active Employees',`${employees.filter(r=>r.status!=='Inactive').length} active`,'Current'],['Total Employees',`${employees.length} records`,String(employees.length)]],total:['Employee Count',String(employees.length)]}]],
  }
  const selected = map[title]
  if (selected) return { tone, subtitle:selected[0], sections:selected[1] }
  const countMap = { vendors:vendors.length, employees:employees.length, invoices:invoices.length, expenses:expenses.length, payroll:payroll.length, sales:sales.length }
  return { tone, subtitle:'Selected period details', sections:[{title:'Summary',rows:[['Current Total','Calculated from current records',appMoney(0)],['Entries','Included records',String(Math.max(...Object.values(countMap),0))],['Status','Ready for review','Current']],total:['Selected Total',appMoney(0)]}] }
}

function buildRecentEntries(title, collections) {
  let rows = []
  if (/sale/i.test(title || '')) rows = collections.sales.map(r=>[r.date||'—',`${r.category||'Sale'} · ${r.payment||'Other'}`,appMoney2(r.amount)])
  else if (/invoice|cost|vendor/i.test(title || '')) rows = collections.invoices.map(r=>[r.date||r.invoice_date||'—',`${r.vendor||'Vendor'} · ${r.number||r.invoice_number||'Invoice'}`,appMoney2(r.amount??r.total)])
  else if (/expense/i.test(title || '')) rows = collections.expenses.map(r=>[r.date||'—',`${r.vendor||'Vendor'} · ${r.type||r.category||'Expense'}`,appMoney2(r.amount??r.total)])
  else if (/payroll|labor/i.test(title || '')) rows = collections.payroll.map(r=>[r.pay_date||r.date||'—',`${r.employee_name||r.employee||'Employee'} · ${r.payment_method||r.method||'Method'}`,appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.credit_card_tips||r.tips||0)-Number(r.tip_deduction||0)+Number(r.extra_pay||0)))])
  return rows.slice(0,8)
}

const routeMap = {
  'Net Sales':'/sales','Cash Sales':'/sales','Credit Sales':'/sales','Other Sales':'/sales','Tips Earned':'/sales','Sales Summary':'/sales',
  'Cost Breakdown':'/food-alcohol-cost','Food Cost':'/food-alcohol-cost','Alcohol Cost':'/food-alcohol-cost','True Food Cost':'/food-alcohol-cost','True Alcohol Cost':'/food-alcohol-cost',
  'Food Invoices':'/invoices','Alcohol Invoices':'/invoices','Invoice Total':'/invoices','Open Balance':'/invoices',
  'Vendor Spend':'/vendors','Total Vendors':'/vendors','Inventory Vendors':'/vendors','Expense Vendors':'/vendors',
  'Compared Items':'/vendor-comparison','Best Savings':'/vendor-comparison','Matched Sizes':'/vendor-comparison','Potential Savings':'/vendor-comparison',
  'Items Increased':'/price-increase','Average Increase':'/price-increase','Largest Increase':'/price-increase','Items Decreased':'/price-increase',
  'Total Employees':'/employees','Active Employees':'/employees','Kitchen Staff':'/employees','Front of House':'/employees','Weekly Base Pay':'/employees',
  'Payroll Total':'/payroll','Cash Payroll':'/payroll','Check Payroll':'/payroll','Total Hours':'/payroll',
  'Total Expenses':'/expenses','Cash Expenses':'/expenses','Check / ACH':'/expenses','Credit Expenses':'/expenses',
  'Bank Activity':'/bank-checks','Cleared Payments':'/bank-checks','Pending Payments':'/bank-checks','Checks Issued':'/bank-checks',
  'Sales Imports':'/import-center','Labor Imports':'/import-center','Invoice Imports':'/import-center','Completed':'/import-center',
  'Connection Status':'/toast-integration','Last Sales Sync':'/toast-integration','Last Labor Sync':'/toast-integration','Pending Jobs':'/toast-integration',
}

export default function DetailDrawer({ title, onClose }) {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [activeTab, setActiveTab] = useState('Overview')
  const [expanded, setExpanded] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [notes, setNotes] = useState('')
  const { range: globalRange } = useGlobalDateRange()
  const [drawerRange, setDrawerRange] = useState(() => readDateRange())
  const [draftRange, setDraftRange] = useState(() => readDateRange())
  const appData = useAppData(drawerRange)
  const { metrics, sales, invoices, expenses, payroll, vendors, employees } = appData
  const content = useMemo(() => buildDrawerContent(title, appData), [title, appData])

  useEffect(() => {
    setActiveTab('Overview'); setExpanded(false); setSelectedRow(null)
    const activeRange = readDateRange()
    setDrawerRange(activeRange); setDraftRange(activeRange)
    if (title) setNotes(localStorage.getItem(`restapay.drawer.notes.${title}`) || '')
  }, [title, globalRange.from, globalRange.to, globalRange.preset])

  const categoryRows = useMemo(() => content.sections.flatMap((section) => section.rows.map((row) => ({ section: section.title, row }))), [content])
  const recentEntries = useMemo(() => buildRecentEntries(title, { sales, invoices, expenses, payroll, vendors, employees }), [title, sales, invoices, expenses, payroll, vendors, employees])
  if (!title) return null

  const openWorkspace = () => { const target = routeMap[title] || '/dashboard'; onClose?.(); navigate(target) }
  const exportDrawer = () => {
    const csv = [['Section','Item','Details','Value'], ...categoryRows.map(({section,row}) => [section,...row])]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-details.csv`; anchor.click(); URL.revokeObjectURL(url)
    notify(`${title} details exported.`)
  }
  const saveNotes = () => { localStorage.setItem(`restapay.drawer.notes.${title}`, notes); notify(`${title} notes saved locally.`) }
  const handleDrawerPreset = (preset) => {
    const dates = presetDates(preset)
    setDraftRange(dates || { ...draftRange, preset:'custom' })
  }
  const applyDrawerRange = () => {
    if (!draftRange.from || !draftRange.to) return notify('Choose both From and To dates.', 'error')
    if (draftRange.from > draftRange.to) return notify('From date cannot be after To date.', 'error')
    setDrawerRange({ ...draftRange })
  }

  return <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className={`detail-drawer drawer-${content.tone} ${expanded ? 'drawer-expanded' : ''}`} role="dialog" aria-modal="true" aria-label={`${title} details`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="drawer-header"><div><h2>{title}</h2><p>{content.subtitle}</p></div><div className="drawer-header-actions">
        <button type="button" className="drawer-icon-button" aria-label={expanded ? 'Restore size' : 'Expand'} onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={18}/> : <Expand size={18}/>}</button>
        <button type="button" className="drawer-icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button>
      </div></header>
      <div className="drawer-range drawer-range-controls" style={{display:'grid',gap:12}}>
        <div className="drawer-range-current" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}><span>Date Range</span><strong>{formatRangeDate(drawerRange.from)} — {formatRangeDate(drawerRange.to)}</strong></div>
        <div className="drawer-range-editor" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',width:'100%'}}>
          <select aria-label="Detail date range preset" value={draftRange.preset || 'custom'} onChange={event => handleDrawerPreset(event.target.value)} style={{minHeight:42,minWidth:150}}>
            <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This Week</option><option value="last-week">Last Week</option><option value="month">This Month</option><option value="last-month">Last Month</option><option value="quarter">This Quarter</option><option value="last-quarter">Last Quarter</option><option value="year">This Year</option><option value="last-year">Last Year</option><option value="custom">Custom Range</option>
          </select>
          <input aria-label="Detail range from" type="date" value={draftRange.from || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',from:event.target.value})} style={{minHeight:42}}/>
          <span>—</span>
          <input aria-label="Detail range to" type="date" value={draftRange.to || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',to:event.target.value})} style={{minHeight:42}}/>
          <button type="button" onClick={applyDrawerRange} style={{minHeight:42,padding:'0 18px',fontWeight:700}}>Apply</button>
        </div>
      </div>
      <nav className="drawer-tabs" aria-label="Detail sections">{['Overview','By Category','Entries','Notes'].map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} type="button" onClick={() => { setActiveTab(tab); setSelectedRow(null) }}>{tab}</button>)}</nav>

      <div className="drawer-scroll">
        {activeTab === 'Overview' && <>{content.sections.map((section) => <section className="drawer-section" key={section.title}><h3>{section.title}</h3>{section.rows.map(([label,meta,value]) => <button className="drawer-row" type="button" key={`${section.title}-${label}`} onClick={() => setSelectedRow({ label, meta, value, section:section.title })}><span><strong>{label}</strong><small>{meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}<div className="drawer-total"><strong>{section.total[0]}</strong><b>{section.total[1]}</b></div></section>)}
          {selectedRow && <section className="drawer-section drawer-drilldown"><div className="drawer-section-heading"><h3>{selectedRow.label} Details</h3><button onClick={() => setSelectedRow(null)}>Close</button></div><div className="drawer-detail-grid"><div><small>Section</small><strong>{selectedRow.section}</strong></div><div><small>Current Value</small><strong>{selectedRow.value}</strong></div><div><small>Description</small><strong>{selectedRow.meta}</strong></div><div><small>Status</small><strong className="drawer-ready"><CheckCircle2 size={15}/>Ready</strong></div></div><button className="drawer-inline-action" onClick={openWorkspace}>Open related records<ChevronRight size={16}/></button></section>}
        </>}

        {activeTab === 'By Category' && <section className="drawer-section"><h3>Category Breakdown</h3>{categoryRows.map(({section,row:[label,meta,value]}) => <button className="drawer-row" type="button" key={`${section}-${label}`} onClick={() => setSelectedRow({section,label,meta,value})}><span><strong>{label}</strong><small>{section} · {meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}</section>}

        {activeTab === 'Entries' && <section className="drawer-section"><div className="drawer-section-heading"><h3>Included Entries</h3><button type="button" onClick={openWorkspace}>View all</button></div>{recentEntries.length ? recentEntries.map(([date,meta,value], index) => <button className="drawer-row" type="button" key={`${date}-${index}`} onClick={openWorkspace}><span><strong>{date}</strong><small>{meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>) : <div className="drawer-empty">No records for this section.</div>}</section>}

        {activeTab === 'Notes' && <section className="drawer-section drawer-notes"><h3>Notes</h3><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Add notes for ${title}...`}/><button type="button" className="drawer-inline-action" onClick={saveNotes}><Save size={16}/>Save Notes</button></section>}
      </div>

      <footer className="drawer-footer"><button type="button" className="secondary-action" onClick={exportDrawer}><Download size={17}/>Export</button><button type="button" className="secondary-action" onClick={() => window.print()}><Printer size={17}/>Print</button><button type="button" className="drawer-primary" onClick={openWorkspace}>Open Workspace<ChevronRight size={18}/></button></footer>
    </aside>
  </div>
}
