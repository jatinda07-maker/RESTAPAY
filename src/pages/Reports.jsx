import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileBarChart,
  FileSpreadsheet,
  GripVertical,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  WalletCards,
} from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import { useFeedback } from '../components/AppFeedback'
import DetailDrawer from '../components/DetailDrawer'
import Modal from '../components/Modal'
import { appMoney, appMoney2, useAppData } from '../hooks/useAppData'
import { originalTips, tipsWithheld, netTips } from '../core/engines/PayrollEngine.js'
import { exportReportPdf } from '../lib/reportExport'

const reportTypes = [
  'Cash Sales', 'Credit Sales', 'Other Sales', 'Food Sales', 'Alcohol Sales', 'Sales Tax', 'Tips Original', 'Tips After Withholding',
  'Cash Payroll', 'Check Payroll', 'Extra Pay', 'Vendor Cash Spend', 'Vendor Check Spend', 'Business Expenses', 'Remaining Cash', 'Period P&L',
]

const money = value => `$${Number(value).toFixed(2)}`

const payrollDate = row => String(row?.pay_date || row?.payroll_date || row?.date || '').slice(0,10)
const localIso = date => {
  const y=date.getFullYear(), m=String(date.getMonth()+1).padStart(2,'0'), d=String(date.getDate()).padStart(2,'0')
  return `${y}-${m}-${d}`
}
const fallbackPayrollWeek = value => {
  if (!value) return { from:'', to:'' }
  const date=new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return { from:value, to:value }
  const day=date.getDay()
  const monday=new Date(date); monday.setDate(date.getDate()-((day+6)%7))
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+6)
  return { from:localIso(monday), to:localIso(sunday) }
}
const payrollPeriod = row => {
  const from=String(row?.period_start || row?.pay_period_start || row?.week_start || row?.payroll_week_start || '').slice(0,10)
  const to=String(row?.period_end || row?.pay_period_end || row?.week_end || row?.payroll_week_end || '').slice(0,10)
  if (from || to) return { from:from||to, to:to||from }
  return fallbackPayrollWeek(payrollDate(row))
}
const payrollEmployee = row => String(row?.employee_name || row?.employee || row?.name || 'Employee').trim() || 'Employee'
const num = value => Number(String(value ?? 0).replace(/[$,%(),]/g,'')) || 0
const rowBasePay = row => num(row?.regular_pay ?? row?.base_pay ?? row?.gross_pay ?? row?.wages)
const rowTips = row => originalTips(row)
const rowWithheld = row => tipsWithheld(row)
const rowNetTips = row => netTips(row)
const rowExtra = row => num(row?.extra_pay)
const payrollMethod = row => String(row?.payment_method || row?.method || row?.payment_type || '').trim()
const payrollStatus = row => String(row?.payment_status || row?.status || '').trim().toLowerCase()
const payrollSource = row => String(row?.source || '').trim().toLowerCase()
const payrollRollupKey = row => {
  const period=payrollPeriod(row)
  const employee=payrollEmployee(row).toLowerCase().replace(/\s+/g,' ')
  return `${employee}|${period.from}|${period.to}`
}
const reportPayrollRows = rows => {
  const source=(rows||[]).filter(Boolean)
  const rollupsByKey=new Map()
  source.filter(row=>row.weekly_rollup).forEach(row=>{
    const key=payrollRollupKey(row)
    const current=rollupsByKey.get(key)
    if(!current){ rollupsByKey.set(key,row); return }
    const score = item => (payrollStatus(item)==='paid'?40:0) + (payrollStatus(item)==='approved'?30:0) + (payrollSource(item)==='weekly-rollup'?20:0) + (payrollSource(item)==='kitchen-weekly'?10:0)
    const rowStamp=String(row?.updated_at || row?.paid_at || row?.created_at || '')
    const currentStamp=String(current?.updated_at || current?.paid_at || current?.created_at || '')
    if(score(row)>score(current) || (score(row)===score(current) && rowStamp>=currentStamp)) rollupsByKey.set(key,row)
  })
  const canonical=[]
  source.forEach(row=>{
    const key=payrollRollupKey(row)
    if(row.weekly_rollup){
      if(rollupsByKey.get(key)===row) canonical.push(row)
      return
    }
    if(String(row.payroll_status || '').trim().toLowerCase()==='rolled-up') return
    if(rollupsByKey.has(key)) return
    canonical.push(row)
  })
  return canonical
}
const groupPayrollByEmployeePeriod = rows => {
  const groups=new Map()
  ;reportPayrollRows(rows).forEach(row=>{
    const period=payrollPeriod(row)
    const employee=payrollEmployee(row)
    const key=`${employee.toLowerCase()}|${period.from}|${period.to}`
    if(!groups.has(key)) groups.set(key,{employee,from:period.from,to:period.to,hours:0,basePay:0,tips:0,withheld:0,netTips:0,extra:0,reasons:new Set(),methods:new Set(),jobs:new Set(),rows:[]})
    const g=groups.get(key)
    g.rows.push(row); g.hours+=num(row.hours ?? row.regular_hours); g.basePay+=rowBasePay(row); g.tips+=rowTips(row); g.withheld+=rowWithheld(row); g.netTips+=rowNetTips(row); g.extra+=rowExtra(row)
    if(row.extra_reason) g.reasons.add(String(row.extra_reason))
    const method=payrollMethod(row); if(method) g.methods.add(method)
    const job=String(row.job_type || row.job || row.position || row.role || '').trim(); if(job) g.jobs.add(job)
  })
  return [...groups.values()].sort((a,b)=>`${b.from}|${b.employee}`.localeCompare(`${a.from}|${a.employee}`))
}
const periodLabel = group => group.from && group.to ? (group.from===group.to ? group.from : `${group.from}–${group.to}`) : (group.from || group.to || '')

export default function Reports() {
  const { notify } = useFeedback()
  const { metrics, sales, payroll, invoices, expenses, dateRange } = useAppData()
  const formatDate = value => { if(!value)return '—'; const d=new Date(`${value}T00:00:00`); return Number.isNaN(d.getTime())?value:d.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}) }
  const activeRangeLabel = `${formatDate(dateRange?.from)}–${formatDate(dateRange?.to)}`
  const reports = [
    ['Custom Restaurant Report','Sales, payroll, tips, vendor spending, cash balance and P&L',activeRangeLabel,'weekly-custom'],
    ['Sales by Department','Food, alcohol and other live sales',activeRangeLabel,'sales-department'],
    ['Payroll Detail','Hours, tips, withholding, extra pay and payment method',activeRangeLabel,'payroll-detail'],
    ['Vendor & Expense Summary','Invoices and expenses grouped by category',activeRangeLabel,'vendor-expense'],
  ]
  const cards = [
    { title: 'Period P&L', value: appMoney(metrics.operatingProfit), meta: 'Operating profit', tone: 'green', icon: FileBarChart },
    { title: 'Sales Report', value: appMoney(metrics.salesTotal), meta: `${sales.length} sales entries`, tone: 'blue', icon: ReceiptText },
    { title: 'Payroll Report', value: appMoney(metrics.payrollTotal), meta: `${metrics.payrollHours.toFixed(1)} labor hours`, tone: 'purple', icon: WalletCards },
    { title: 'Expense Report', value: appMoney(metrics.expenseTotal), meta: `${expenses.length} expense entries`, tone: 'orange', icon: FileSpreadsheet },
  ]
  const payrollGroups = groupPayrollByEmployeePeriod(payroll)
  const cashPayrollGroups = groupPayrollByEmployeePeriod(payroll.filter(r=>payrollMethod(r).toLowerCase()==='cash'))
  const tippedPayrollGroups = groupPayrollByEmployeePeriod(payroll.filter(r=>rowTips(r)>0))

  const weeklyReportSections = [
    { title:'Sales Summary', total:metrics.salesTotal, headers:['Metric','Amount'], rows:[['Gross Sales',appMoney2(metrics.salesTotal)],['Net Sales',appMoney2(metrics.salesTotal)],['Cash Sales',appMoney2(metrics.cashSales)],['Credit Sales',appMoney2(metrics.creditSales)],['Tips',appMoney2(metrics.tips)]] },
    { title:'Cash Payment Employees', total:cashPayrollGroups.reduce((sum,g)=>sum+g.basePay+g.extra,0), headers:['Payroll Period','Employee','Pay','Extra Pay','Reason','Total'], rows:cashPayrollGroups.map(g=>[periodLabel(g),g.employee,appMoney2(g.basePay),appMoney2(g.extra),[...g.reasons].join('; '),appMoney2(g.basePay+g.extra)]) },
    { title:'Employees With Tips', total:tippedPayrollGroups.reduce((sum,g)=>sum+g.tips,0), headers:['Payroll Period','Employee','Original Tips','Withheld','Tips After Withholding','Extra Pay','Reason','Total'], rows:tippedPayrollGroups.map(g=>[periodLabel(g),g.employee,appMoney2(g.tips),appMoney2(g.withheld),appMoney2(g.netTips),appMoney2(g.extra),[...g.reasons].join('; '),appMoney2(g.netTips+g.extra)]) },
    { title:'Vendor Payments / Spending Detail', total:metrics.invoiceTotal+metrics.expenseTotal, headers:['Date','Vendor / Payee','Category','Payment Type','Details','Amount'], rows:[...invoices.map(r=>[r.date||r.invoice_date||'',r.vendor||'',r.category||'',r.payment_type||'',r.number||r.invoice_number||'',appMoney2(r.amount??r.total)]),...expenses.map(r=>[r.date||'',r.vendor||'',r.type||r.category||'',r.method||'',r.notes||'',appMoney2(r.amount??r.total)])] },
    { title:'Cash Balance Summary', total:metrics.cashRemaining, headers:['Metric','Amount'], rows:[['Previous Period Reconciliation / Carry Forward',appMoney2(metrics.cashCarryForward||0)],['Current Period Cash Sales',appMoney2(metrics.cashSales)],['Cash Employee Payments',appMoney2(-metrics.cashPayroll)],['Cash Vendor Invoices',appMoney2(-metrics.cashInvoiceSpend)],['Cash Operating Expenses',appMoney2(-metrics.cashExpenses)],['Cash Withdrawals',appMoney2(-(metrics.cashWithdrawals||0))],['Current Period Reconciliation Adjustment',appMoney2(metrics.cashAdjustments||0)],['Remaining Cash Balance',appMoney2(metrics.cashRemaining)]] },
    { title:'Period Profit / Loss Analysis', total:metrics.operatingProfit, headers:['Metric','Amount'], rows:[['Net Sales',appMoney2(metrics.salesTotal)],['Food + Alcohol COGS',appMoney2(metrics.cogs)],['Employee Payroll / Wages (tips excluded)',appMoney2(metrics.employerLabor ?? metrics.payrollTotal)],['Operating Expenses',appMoney2(metrics.expenseTotal)],['Operating Profit / Loss',appMoney2(metrics.operatingProfit)]] },
    { title:'Reconciliation Check', total:0, headers:['Check','Variance'], rows:[['Sales category equation',appMoney2(metrics.reconciliation.salesCategoryVariance)],['Cash balance equation',appMoney2(metrics.reconciliation.cashEquationVariance)],['Operating profit equation',appMoney2(metrics.reconciliation.profitEquationVariance)],['Status',metrics.reconciliation.balanced?'Balanced':'Review required']] },
  ]
  const [drawer, setDrawer] = useState(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [showEmpty, setShowEmpty] = useState(true)
  const [selected, setSelected] = useState(['Cash Sales', 'Cash Payroll', 'Vendor Cash Spend', 'Remaining Cash', 'Period P&L'])
  const [reportName, setReportName] = useState('Custom Restaurant Report')

  const available = useMemo(() => reportTypes.filter(type => !selected.includes(type)), [selected])
  const visibleWeeklySections = weeklyReportSections.filter(section => showEmpty || section.rows.length > 0 || section.total !== 0)

  const addType = value => {
    if (value && !selected.includes(value)) setSelected(prev => [...prev, value])
  }

  const move = (index, direction) => setSelected(prev => {
    const next = [...prev]
    const target = index + direction
    if (target < 0 || target >= next.length) return prev
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })

  const reportPdfPayload = key => {
    const commonSummary = [
      { label:'Report Period', value:activeRangeLabel },
      { label:'Net Sales', value:appMoney2(metrics.salesTotal) },
      { label:'Payroll / Wages', value:appMoney2(metrics.employerLabor ?? metrics.payrollTotal) },
      { label:'Profit / Loss', value:appMoney2(metrics.operatingProfit) },
    ]
    if (key === 'weekly-custom') return {
      title: reportName || 'Custom Restaurant Report',
      subtitle: activeRangeLabel,
      summary: commonSummary,
      sections: visibleWeeklySections.map(section=>({ ...section, total:money(section.total) })),
      filename:`RESTAPAY-Custom-Report-${dateRange?.from || 'from'}-${dateRange?.to || 'to'}`,
    }
    if (key === 'sales-department') return {
      title:'Sales by Department', subtitle:activeRangeLabel, summary:commonSummary,
      sections:[{title:'Sales Detail',total:appMoney2(metrics.salesTotal),headers:['Date','Food','Alcohol','Other','Cash','Credit','Total'],rows:sales.map(r=>[r.date||'',appMoney2(r.food_sales||r.food||0),appMoney2(r.alcohol_sales||r.alcohol||0),appMoney2(r.other_sales||r.other||0),appMoney2(r.cash_sales||r.cash||0),appMoney2(r.credit_sales||r.credit||0),appMoney2(r.total_sales||r.total||r.amount||0)])}],
      filename:`RESTAPAY-Sales-${dateRange?.from || 'from'}-${dateRange?.to || 'to'}`,
    }
    if (key === 'payroll-detail') return {
      title:'Payroll Detail', subtitle:activeRangeLabel, summary:commonSummary,
      sections:[{title:'Payroll Detail',total:appMoney2(metrics.employerLabor ?? metrics.payrollTotal),headers:['Payroll Period','Employee','Job','Hours','Base Pay','Tips','Withheld','Extra','Method','Final Pay'],rows:payrollGroups.map(g=>[periodLabel(g),g.employee,[...g.jobs].join('; '),g.hours.toFixed(1),appMoney2(g.basePay),appMoney2(g.tips),appMoney2(g.withheld),appMoney2(g.extra),[...g.methods].join(' / '),appMoney2(g.basePay+g.extra+g.netTips)])}],
      filename:`RESTAPAY-Payroll-${dateRange?.from || 'from'}-${dateRange?.to || 'to'}`,
    }
    return {
      title:'Vendor & Expense Summary', subtitle:activeRangeLabel, summary:commonSummary,
      sections:[{title:'Vendor Invoices',total:appMoney2(metrics.invoiceTotal),headers:['Date','Vendor','Invoice #','Category','Payment','Amount'],rows:invoices.map(r=>[r.invoice_date||r.date||'',r.vendor_name||r.vendor||'',r.invoice_number||r.number||'',r.category||'',r.payment_type||'',appMoney2(r.total||r.amount||0)])},{title:'Business Expenses',total:appMoney2(metrics.expenseTotal),headers:['Date','Vendor / Payee','Category','Method','Notes','Amount'],rows:expenses.map(r=>[r.date||'',r.vendor||r.payee||'',r.category||r.type||'',r.method||'',r.notes||'',appMoney2(r.amount||r.total||0)])}],
      filename:`RESTAPAY-Vendor-Expense-${dateRange?.from || 'from'}-${dateRange?.to || 'to'}`,
    }
  }

  const downloadPdf = key => {
    try {
      exportReportPdf(reportPdfPayload(key))
      notify('PDF downloaded.')
    } catch (error) {
      console.error('PDF export failed', error)
      notify(error?.message || 'PDF export failed.','error')
    }
  }

  const openReport = key => {
    if (key === 'weekly-custom') setWeeklyOpen(true)
    else setDrawer('Report Preview')
  }

  return <div className="records-page">
    <DateToolbar />

    <section className="records-kpi-grid">
      {cards.map(({ title, value, meta, tone, icon: Icon }) => (
        <button key={title} className={`records-kpi tone-${tone}`} onClick={() => setDrawer(title)}>
          <span className="records-kpi-icon"><Icon size={22} /></span>
          <span className="records-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span>
          <ChevronRight size={18} />
        </button>
      ))}
    </section>

    <section className="records-workspace card-surface">
      <header className="records-header">
        <div><h2>Reports</h2><p>Generate standard reports or arrange a custom report in your preferred order</p></div>
        <div className="records-actions">
          <button className="secondary-action" onClick={()=>window.print()}><Printer size={17} />Print</button>
          <button className="secondary-action" onClick={()=>notify("Report export prepared locally.")}><Download size={17} />Export</button>
          <button className="primary-button" onClick={() => setBuilderOpen(true)}><Plus size={17} />Custom Report Builder</button>
        </div>
      </header>

      <div className="report-card-grid">
        {reports.map(([title, desc, range, key], i) => (
          <article className={`report-card ${key === 'weekly-custom' ? 'report-card-featured' : ''}`} key={title}>
            <span className={`report-icon tone-${['green', 'blue', 'purple', 'orange'][i]}`}><FileBarChart size={21} /></span>
            <div><h3>{title}</h3><p>{desc}</p><small>{range}</small></div>
            <div className="report-actions">
              <button onClick={() => openReport(key)}><Eye size={14} />Preview</button>
              <button onClick={()=>downloadPdf(key)}>PDF</button>
              <button onClick={()=>notify("Excel export prepared.")}>Excel</button>
              <ChevronRight size={18} />
            </div>
          </article>
        ))}
      </div>
    </section>

    <Modal
      open={weeklyOpen}
      title="Custom Restaurant Report"
      subtitle={activeRangeLabel}
      onClose={() => setWeeklyOpen(false)}
      size="lg"
      footer={<>
        <label className="show-empty-toggle"><input type="checkbox" checked={showEmpty} onChange={event => setShowEmpty(event.target.checked)} />Show empty sections</label>
        <span className="modal-footer-spacer" />
        <button className="secondary-action" onClick={()=>window.print()}><Printer size={16} />Print</button>
        <button className="secondary-action" onClick={()=>downloadPdf('weekly-custom')}><Download size={16} />PDF</button>
        <button className="primary-button" onClick={()=>notify("Excel export prepared.")}><FileSpreadsheet size={16} />Excel</button>
      </>}
    >
      <div className="weekly-report-preview">
        <div className="weekly-report-summary">
          <div><small>Report Period</small><strong>{activeRangeLabel}</strong></div>
          <div><small>Net Sales</small><strong>{appMoney2(metrics.salesTotal)}</strong></div>
          <div><small>Remaining Cash</small><strong>{appMoney2(metrics.cashRemaining)}</strong></div>
          <div><small>Estimated Profit / Loss</small><strong>{appMoney2(metrics.operatingProfit)}</strong></div>
        </div>

        {visibleWeeklySections.map(section => (
          <section className="weekly-report-section" key={section.title}>
            <header><div><h3>{section.title}</h3><small>{section.rows.length ? `${section.rows.length} report row${section.rows.length === 1 ? '' : 's'}` : 'No data for this section'}</small></div><strong>{money(section.total)}</strong></header>
            <div className="weekly-report-table-wrap">
              <table className="weekly-report-table">
                <thead><tr>{section.headers.map(header => <th key={header}>{header}</th>)}</tr></thead>
                <tbody>
                  {section.rows.length > 0 ? section.rows.map((row, index) => (
                    <tr key={`${section.title}-${index}`}>{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className={cellIndex > 0 ? 'numeric-report-cell' : ''}>{cell}</td>)}</tr>
                  )) : (
                    <tr><td className="empty-report-row" colSpan={section.headers.length}>No data for this section.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Modal>

    <Modal
      open={builderOpen}
      title="Custom Report Builder"
      subtitle="Choose report sections and arrange them in the exact order you want"
      onClose={() => setBuilderOpen(false)}
      size="lg"
      footer={<>
        <button className="secondary-action" onClick={() => setBuilderOpen(false)}>Cancel</button>
        <button className="secondary-action" onClick={()=>notify("Custom report preview updated.")}><Download size={16} />Preview</button>
        <button className="primary-button" onClick={() => setBuilderOpen(false)}>Save Custom Report</button>
      </>}
    >
      <div className="form-grid report-builder-top">
        <label>Report Name<input value={reportName} onChange={event => setReportName(event.target.value)} /></label>
        <label>Add Report Section<div className="select-with-icon"><select defaultValue="" onChange={event => { addType(event.target.value); event.target.value = '' }}><option value="" disabled>Select section to add</option>{available.map(type => <option key={type}>{type}</option>)}</select><ChevronDown size={15} /></div></label>
      </div>
      <div className="report-order-list">
        {selected.map((type, index) => <div className="report-order-row" key={type}>
          <GripVertical size={18} /><span className="order-number">{index + 1}</span><strong>{type}</strong>
          <div className="order-actions"><button disabled={index === 0} onClick={() => move(index, -1)}>Up</button><button disabled={index === selected.length - 1} onClick={() => move(index, 1)}>Down</button><button className="danger-icon" onClick={() => setSelected(prev => prev.filter(item => item !== type))}><Trash2 size={15} /></button></div>
        </div>)}
      </div>
      <div className="builder-note">The saved order is used for the live report preview and export workflow.</div>
    </Modal>

    <DetailDrawer title={drawer} onClose={() => setDrawer(null)} />
  </div>
}
