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

const cards = [
  { title: 'Weekly P&L', value: '$32,310', meta: 'Operating profit', tone: 'green', icon: FileBarChart },
  { title: 'Sales Report', value: '$104,342', meta: '24 sales entries', tone: 'blue', icon: ReceiptText },
  { title: 'Payroll Report', value: '$18,110', meta: '486.5 labor hours', tone: 'purple', icon: WalletCards },
  { title: 'Expense Report', value: '$12,780', meta: '18 expense entries', tone: 'orange', icon: FileSpreadsheet },
]

const reportTypes = [
  'Cash Sales', 'Credit Sales', 'Other Sales', 'Food Sales', 'Alcohol Sales', 'Sales Tax', 'Tips Original', 'Tips After Withholding',
  'Cash Payroll', 'Check Payroll', 'Extra Pay', 'Vendor Cash Spend', 'Vendor Check Spend', 'Business Expenses', 'Remaining Cash', 'Weekly P&L',
]

const reports = [
  ['Custom Weekly Restaurant Report', 'Sales, payroll, tips, vendor spending, cash balance and weekly P&L', 'Aug 01–Aug 04, 2026', 'weekly-custom'],
  ['Sales by Department', 'Food, beer, wine, liquor and other sales', 'Aug 01–Aug 04, 2026', 'sales-department'],
  ['Payroll Detail', 'Hours, tips, withholding, extra pay and payment method', 'Aug 01–Aug 04, 2026', 'payroll-detail'],
  ['Vendor & Expense Summary', 'Invoices and expenses grouped by category', 'Aug 01–Aug 04, 2026', 'vendor-expense'],
]

const money = value => `$${Number(value).toFixed(2)}`

const weeklyReportSections = [
  {
    title: 'Weekly Sales Summary',
    total: 7664.10,
    headers: ['Metric', 'Amount'],
    rows: [
      ['Gross Sales', money(7664.10)],
      ['Net Sales', money(7664.10)],
      ['Cash Sales', money(1469.27)],
      ['Credit Sales', money(6742.44)],
      ['Gift Card Sales', money(7.75)],
      ['Tips', money(1230.57)],
      ['Refunds', money(0)],
      ['Discounts', money(0)],
    ],
  },
  {
    title: 'Cash Payment Employees',
    total: 0,
    headers: ['Date', 'Employee', 'Pay', 'Extra Pay', 'Reason', 'Total'],
    rows: [],
  },
  {
    title: 'Employees With Tips',
    total: 0,
    headers: ['Date', 'Employee', 'Original Tips', 'Withheld', 'Tips After Withholding', 'Extra Pay', 'Reason', 'Total'],
    rows: [['Subtotals', '', money(0), money(0), money(0), '', '', money(0)]],
  },
  {
    title: 'Vendor Payments / Spending Detail',
    total: 0,
    headers: ['Date', 'Vendor / Payee', 'Category', 'Payment Type', 'Details', 'Amount'],
    rows: [],
  },
  {
    title: 'Vendor Cash Expenses',
    total: 0,
    headers: ['Date', 'Vendor / Payee', 'Category', 'Note', 'Amount'],
    rows: [],
  },
  {
    title: 'Vendor Check Expenses',
    total: 0,
    headers: ['Date', 'Vendor / Payee', 'Category', 'Note', 'Amount'],
    rows: [],
  },
  {
    title: 'Cash Balance Summary',
    total: 1469.27,
    headers: ['Metric', 'Amount'],
    rows: [
      ['Cash Sales', money(1469.27)],
      ['Cash Employee Payments', money(0)],
      ['Cash Vendor Expenses', money(0)],
      ['Total Cash Spending', money(0)],
      ['Remaining Cash Balance', money(1469.27)],
    ],
  },
  {
    title: 'Weekly Spending Summary By Category',
    total: 0,
    headers: ['Category', 'Cash', 'Check', 'Credit', 'ACH', 'Other', 'Total'],
    rows: ['Food', 'Beverage', 'Beer', 'Liquor', 'Supplies', 'Utilities', 'Maintenance', 'Insurance', 'Accounting Fees', 'Loans', 'Cash Expenses', 'Restaurant Expenses', 'Other']
      .map(category => [category, money(0), money(0), money(0), money(0), money(0), money(0)]),
  },
  {
    title: 'Weekly Profit / Loss Analysis',
    total: 7664.10,
    headers: ['Metric', 'Amount'],
    rows: [
      ['Net Sales', money(7664.10)],
      ['Employee Payroll Total', money(0)],
      ['Vendor / Invoice / Expense Spending', money(0)],
      ['Manual Expenses Included', money(0)],
      ['Total Weekly Spending', money(0)],
      ['Estimated Profit / Loss', money(7664.10)],
    ],
  },
]

export default function Reports() {
  const { notify } = useFeedback()
  const { metrics, sales, payroll, invoices, expenses } = useAppData()
  const cards = [
    { title: 'Weekly P&L', value: appMoney(metrics.operatingProfit), meta: 'Operating profit', tone: 'green', icon: FileBarChart },
    { title: 'Sales Report', value: appMoney(metrics.salesTotal), meta: `${sales.length} sales entries`, tone: 'blue', icon: ReceiptText },
    { title: 'Payroll Report', value: appMoney(metrics.payrollTotal), meta: `${metrics.payrollHours.toFixed(1)} labor hours`, tone: 'purple', icon: WalletCards },
    { title: 'Expense Report', value: appMoney(metrics.expenseTotal), meta: `${expenses.length} expense entries`, tone: 'orange', icon: FileSpreadsheet },
  ]
  const weeklyReportSections = [
    { title:'Weekly Sales Summary', total:metrics.salesTotal, headers:['Metric','Amount'], rows:[['Gross Sales',appMoney2(metrics.salesTotal)],['Net Sales',appMoney2(metrics.salesTotal)],['Cash Sales',appMoney2(metrics.cashSales)],['Credit Sales',appMoney2(metrics.creditSales)],['Tips',appMoney2(metrics.tips)]] },
    { title:'Cash Payment Employees', total:metrics.cashPayroll, headers:['Date','Employee','Pay','Extra Pay','Reason','Total'], rows:payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').map(r=>[r.pay_date||r.date||'',r.employee_name||r.employee||'',appMoney2(r.regular_pay||r.base_pay||0),appMoney2(r.extra_pay||0),r.extra_reason||'',appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.extra_pay||0)))]) },
    { title:'Employees With Tips', total:payroll.reduce((s,r)=>s+(Number(r.credit_card_tips||r.tips||0)-Number(r.tip_deduction||0)),0), headers:['Date','Employee','Original Tips','Withheld','Tips After Withholding','Extra Pay','Reason','Total'], rows:payroll.filter(r=>Number(r.credit_card_tips||r.tips||0)>0).map(r=>{const tips=Number(r.credit_card_tips||r.tips||0),withheld=Number(r.tip_deduction||0),extra=Number(r.extra_pay||0);return [r.pay_date||r.date||'',r.employee_name||r.employee||'',appMoney2(tips),appMoney2(withheld),appMoney2(tips-withheld),appMoney2(extra),r.extra_reason||'',appMoney2(tips-withheld+extra)]}) },
    { title:'Vendor Payments / Spending Detail', total:metrics.invoiceTotal+metrics.expenseTotal, headers:['Date','Vendor / Payee','Category','Payment Type','Details','Amount'], rows:[...invoices.map(r=>[r.date||r.invoice_date||'',r.vendor||'',r.category||'',r.payment_type||'',r.number||r.invoice_number||'',appMoney2(r.amount??r.total)]),...expenses.map(r=>[r.date||'',r.vendor||'',r.type||r.category||'',r.method||'',r.notes||'',appMoney2(r.amount??r.total)])] },
    { title:'Cash Balance Summary', total:metrics.cashRemaining, headers:['Metric','Amount'], rows:[['Cash Sales',appMoney2(metrics.cashSales)],['Cash Employee Payments',appMoney2(metrics.cashPayroll)],['Cash Vendor Expenses',appMoney2(metrics.cashExpenses)],['Remaining Cash Balance',appMoney2(metrics.cashRemaining)]] },
    { title:'Weekly Profit / Loss Analysis', total:metrics.operatingProfit, headers:['Metric','Amount'], rows:[['Net Sales',appMoney2(metrics.salesTotal)],['Employee Payroll Total',appMoney2(metrics.payrollTotal)],['Vendor / Invoice Spending',appMoney2(metrics.invoiceTotal)],['Manual Expenses Included',appMoney2(metrics.expenseTotal)],['Estimated Profit / Loss',appMoney2(metrics.operatingProfit)]] },
  ]
  const [drawer, setDrawer] = useState(null)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [showEmpty, setShowEmpty] = useState(true)
  const [selected, setSelected] = useState(['Cash Sales', 'Cash Payroll', 'Vendor Cash Spend', 'Remaining Cash', 'Weekly P&L'])
  const [reportName, setReportName] = useState('Weekly Custom Report')

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
              <button onClick={()=>notify("PDF preview prepared.")}>PDF</button>
              <button onClick={()=>notify("Excel export prepared.")}>Excel</button>
              <ChevronRight size={18} />
            </div>
          </article>
        ))}
      </div>
    </section>

    <Modal
      open={weeklyOpen}
      title="Custom Weekly Restaurant Report"
      subtitle="2026-08-01 to 2026-08-04"
      onClose={() => setWeeklyOpen(false)}
      size="lg"
      footer={<>
        <label className="show-empty-toggle"><input type="checkbox" checked={showEmpty} onChange={event => setShowEmpty(event.target.checked)} />Show empty sections</label>
        <span className="modal-footer-spacer" />
        <button className="secondary-action" onClick={()=>window.print()}><Printer size={16} />Print</button>
        <button className="secondary-action" onClick={()=>notify("PDF export prepared.")}><Download size={16} />PDF</button>
        <button className="primary-button" onClick={()=>notify("Excel export prepared.")}><FileSpreadsheet size={16} />Excel</button>
      </>}
    >
      <div className="weekly-report-preview">
        <div className="weekly-report-summary">
          <div><small>Report Period</small><strong>Aug 01–Aug 04, 2026</strong></div>
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
      <div className="builder-note">The saved order will be used for PDF, Excel, print, and the final calculation engine when connected.</div>
    </Modal>

    <DetailDrawer title={drawer} onClose={() => setDrawer(null)} />
  </div>
}
