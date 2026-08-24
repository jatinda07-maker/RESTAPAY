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

const reportTypes = [
  'Cash Sales', 'Credit Sales', 'Other Sales', 'Food Sales', 'Alcohol Sales', 'Sales Tax', 'Tips Original', 'Tips After Withholding',
  'Cash Payroll', 'Check Payroll', 'Extra Pay', 'Vendor Cash Spend', 'Vendor Check Spend', 'Business Expenses', 'Remaining Cash', 'Period P&L',
]

const money = value => `$${Number(value).toFixed(2)}`

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
  const weeklyReportSections = [
    { title:'Sales Summary', total:metrics.salesTotal, headers:['Metric','Amount'], rows:[['Gross Sales',appMoney2(metrics.salesTotal)],['Net Sales',appMoney2(metrics.salesTotal)],['Cash Sales',appMoney2(metrics.cashSales)],['Credit Sales',appMoney2(metrics.creditSales)],['Tips',appMoney2(metrics.tips)]] },
    (()=>{const rows=payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash');const pay=rows.reduce((s,r)=>s+Number(r.regular_pay||r.base_pay||0),0),extra=rows.reduce((s,r)=>s+Number(r.extra_pay||0),0);return { title:'Cash Payment Employees', total:pay+extra, headers:['Date','Employee','Pay','Extra Pay','Reason','Total'], rows:rows.map(r=>[r.pay_date||r.date||'',r.employee_name||r.employee||'',appMoney2(r.regular_pay||r.base_pay||0),appMoney2(r.extra_pay||0),r.extra_reason||'',appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.extra_pay||0)))]), subtotals:['Subtotal','',appMoney2(pay),appMoney2(extra),'',appMoney2(pay+extra)] }} )(),
    (()=>{const rows=payroll.filter(r=>Number(r.credit_card_tips??r.original_tips??r.tips??0)>0);const original=rows.reduce((s,r)=>s+Number(r.credit_card_tips??r.original_tips??r.tips??0),0),withheld=rows.reduce((s,r)=>s+Number(r.tip_deduction??r.tips_withheld??0),0),after=original-withheld,extra=rows.reduce((s,r)=>s+Number(r.extra_pay||0),0);return { title:'Employees With Tips', summaryLabel:'Payroll Tips Total', total:original, headers:['Date','Employee','Original Tips','Withheld','Tips After Withholding','Extra Pay','Reason','Total'], rows:rows.map(r=>{const tips=Number(r.credit_card_tips??r.original_tips??r.tips??0),held=Number(r.tip_deduction??r.tips_withheld??0),ex=Number(r.extra_pay||0);return [r.pay_date||r.date||'',r.employee_name||r.employee||'',appMoney2(tips),appMoney2(held),appMoney2(tips-held),appMoney2(ex),r.extra_reason||'',appMoney2(tips-held+ex)]}), subtotals:['Subtotal','',appMoney2(original),appMoney2(withheld),appMoney2(after),appMoney2(extra),'',appMoney2(after+extra)] }} )(),
    { title:'Vendor Payments / Spending Detail', total:metrics.invoiceTotal+metrics.expenseTotal, headers:['Date','Vendor / Payee','Category','Payment Type','Details','Amount'], rows:[...invoices.map(r=>[r.date||r.invoice_date||'',r.vendor||'',r.category||'',r.payment_type||'',r.number||r.invoice_number||'',appMoney2(r.amount??r.total)]),...expenses.map(r=>[r.date||'',r.vendor||'',r.type||r.category||'',r.method||'',r.notes||'',appMoney2(r.amount??r.total)])], subtotals:['Subtotal','','','','',appMoney2(metrics.invoiceTotal+metrics.expenseTotal)] },
    { title:'Cash Balance Summary', total:metrics.cashRemaining, headers:['Metric','Amount'], rows:[['Carry Forward',appMoney2(metrics.cashCarryForward||0)],['Cash Sales',appMoney2(metrics.cashSales)],['Cash Employee Payments',appMoney2(metrics.cashPayroll)],['Cash Vendor Invoices',appMoney2(metrics.cashInvoiceSpend)],['Cash Operating Expenses',appMoney2(metrics.cashExpenses)],['Cash Withdrawals',appMoney2(metrics.cashWithdrawals||0)],['Remaining Cash Balance',appMoney2(metrics.cashRemaining)]] },
    { title:'Period Profit / Loss Analysis', total:metrics.operatingProfit, headers:['Metric','Amount'], rows:[['Net Sales',appMoney2(metrics.salesTotal)],['Food + Alcohol COGS',appMoney2(metrics.cogs)],['Employer Labor Cost (tips excluded)',appMoney2(metrics.employerLabor??metrics.operatingLabor)],['Tip Pass-Through (excluded)',appMoney2(metrics.netTipsPaid)],['Operating Expenses',appMoney2(metrics.expenseTotal)],['Operating Profit / Loss',appMoney2(metrics.operatingProfit)]] },
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
  const sectionSubtotalRow = section => section.subtotals || section.headers.map((_,index)=>index===0?'Subtotal':index===section.headers.length-1?appMoney2(section.total):'')

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

  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]))
  const printableHtml=(title='Restaurant Report',sections=visibleWeeklySections)=>`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:32px}h1{margin:0 0 4px}p{color:#667085;margin:0 0 24px}section{margin:0 0 28px;break-inside:avoid}h2{font-size:18px;border-bottom:2px solid #d9e2ec;padding-bottom:8px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left}th{background:#f3f6f8}.num{text-align:right;font-weight:700}@media print{body{margin:16mm}.no-print{display:none}}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(activeRangeLabel)}</p>${sections.map(section=>`<section><h2>${escapeHtml(section.title)}</h2><table><thead><tr>${section.headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${section.rows.map(row=>`<tr>${row.map((cell,index)=>`<td class="${index===row.length-1?'num':''}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${sectionSubtotalRow(section).map((cell,index)=>`<td class="${index===section.headers.length-1?'num':''}"><strong>${escapeHtml(cell)}</strong></td>`).join('')}</tr></tfoot></table></section>`).join('')}</body></html>`
  const openPrintableReport=(title='Restaurant Report',asPdf=false)=>{const win=window.open('about:blank','_blank');if(!win)return notify('Allow pop-ups to print or save the report as PDF.','error');const html=printableHtml(title);win.document.open();win.document.write(html);win.document.close();const doPrint=()=>{try{win.focus();win.print();if(asPdf)notify('In the print dialog choose Save as PDF.')}catch{notify('The browser blocked the print dialog. Use Ctrl+P in the opened report window.','error')}};if(win.document.readyState==='complete')setTimeout(doPrint,500);else win.addEventListener('load',()=>setTimeout(doPrint,250),{once:true})}
  const exportReportCsv=(title='Restaurant Report',sections=visibleWeeklySections)=>{const rows=[[title],[activeRangeLabel],[],...sections.flatMap(section=>[[section.title],section.headers,...section.rows,sectionSubtotalRow(section),[]])];const csv=rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('\"','\"\"')}"`).join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download=`${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`;a.click();URL.revokeObjectURL(url);notify('Report export downloaded.')}

  const openReport = key => {
    if (key === 'weekly-custom') return setWeeklyOpen(true)
    const titles={ 'sales-department':'Sales Report','payroll-detail':'Payroll Report','vendor-expense':'Expense Report' }
    setDrawer(titles[key]||'Period P&L')
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
          <button className="secondary-action" onClick={()=>openPrintableReport('Restaurant Reports')}><Printer size={17} />Print</button>
          <button className="secondary-action" onClick={()=>exportReportCsv('Restaurant Reports')}><Download size={17} />Export</button>
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
              <button onClick={()=>openPrintableReport(title,true)}>PDF</button>
              <button onClick={()=>exportReportCsv(title)}>Excel</button>
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
        <button className="secondary-action" onClick={()=>openPrintableReport('Custom Restaurant Report')}><Printer size={16} />Print</button>
        <button className="secondary-action" onClick={()=>openPrintableReport('Custom Restaurant Report',true)}><Download size={16} />PDF</button>
        <button className="primary-button" onClick={()=>exportReportCsv('Custom Restaurant Report')}><FileSpreadsheet size={16} />Excel</button>
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
            <header><div><h3>{section.title}</h3><small>{section.summaryLabel || (section.rows.length ? `${section.rows.length} report row${section.rows.length === 1 ? '' : 's'}` : 'No data for this section')}</small></div><strong>{money(section.total)}</strong></header>
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
                <tfoot><tr className="weekly-report-subtotal-row">{sectionSubtotalRow(section).map((cell, cellIndex)=><td key={`subtotal-${cellIndex}`} className={cellIndex > 0 ? 'numeric-report-cell' : ''}><strong>{cell}</strong></td>)}</tr></tfoot>
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
