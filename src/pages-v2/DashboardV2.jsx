import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

const money = value => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const num = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const today = () => new Date().toISOString().slice(0, 10)
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const dateOf = row => String(row?.business_date || row?.pay_date || row?.payroll_date || row?.invoice_date || row?.expense_date || row?.date || row?.created_at || '').slice(0, 10)
const inRange = (row, start, end) => { const date = dateOf(row); return !date || ((!start || date >= start) && (!end || date <= end)) }
const first = (row, keys) => { for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null && String(row[key]).trim() !== '') return num(row[key]); return 0 }
const formatShort = iso => { const d = new Date(`${iso}T12:00:00`); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }

function KpiCard({ item, onOpen }) {
  return <button type="button" className={`rv2-kpi rv2-kpi-${item.tone}`} onClick={() => onOpen(item)}>
    <span className="rv2-kpi-icon"><Icon name={item.icon} size={20} /></span>
    <span className="rv2-kpi-body"><span className="rv2-kpi-label">{item.label}</span><strong>{item.value}</strong><small className={item.deltaTone || ''}>{item.delta || item.note}</small><em>{item.compare || ''}</em></span>
    <span className="rv2-kpi-arrow">›</span>
  </button>
}

function LineChart({ sales, cash }) {
  const width = 520, height = 165, pad = 18
  const max = Math.max(...sales, ...cash, 1)
  const points = values => values.map((value, index) => `${pad + index * ((width - pad * 2) / Math.max(values.length - 1, 1))},${height - pad - (value / max) * (height - pad * 2)}`).join(' ')
  return <div className="rv2-chart-card rv2-chart-sales"><header><h2>Sales Trend</h2><select defaultValue="daily"><option value="daily">Daily</option></select></header><div className="rv2-chart-legend"><span className="blue">Total Sales</span><span className="green">Cash Collected</span></div><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Sales trend"><g className="grid">{[30,65,100,135].map(y => <line key={y} x1="18" y1={y} x2="502" y2={y} />)}</g><polyline className="line blue" points={points(sales)} /><polyline className="line green" points={points(cash)} /></svg></div>
}

function Donut({ food, alcohol, beverage, other }) {
  const values = [food, alcohol, beverage, other], total = values.reduce((a,b)=>a+b,0) || 1
  let offset = 0
  const colors = ['#22c55e','#f59e0b','#0ea5e9','#8b5cf6']
  return <div className="rv2-chart-card"><header><h2>Sales by Category</h2></header><div className="rv2-donut-wrap"><svg viewBox="0 0 160 160" className="rv2-donut"><circle cx="80" cy="80" r="50" pathLength="100" className="track" />{values.map((v,i)=>{ const pct=v/total*100; const node=<circle key={i} cx="80" cy="80" r="50" pathLength="100" className="segment" style={{stroke:colors[i],strokeDasharray:`${pct} ${100-pct}`,strokeDashoffset:-offset}}/>; offset += pct; return node})}</svg><div className="rv2-category-list">{[['Food',food,colors[0]],['Alcohol',alcohol,colors[1]],['Beverage',beverage,colors[2]],['Other',other,colors[3]]].map(([label,value,color])=><div key={label}><i style={{background:color}}/><span><strong>{label}</strong><small>{money(value)} ({(value/total*100).toFixed(1)}%)</small></span></div>)}</div></div></div>
}

function Snapshot({ title, rows, totalLabel, totalValue, positive }) {
  return <section className="rv2-info-card"><h2>{title}</h2><div className="rv2-info-rows">{rows.map(row=><div key={row.label}><span>{row.label}</span><strong className={row.tone || ''}>{row.value}</strong></div>)}</div>{totalLabel && <div className="rv2-info-total"><span>{totalLabel}</span><strong className={positive ? 'positive' : ''}>{totalValue}</strong></div>}</section>
}

function Tasks({ setActive }) {
  const tasks = [['Review pending invoices','Invoices','invoices'],['Approve payroll for this week','Payroll','payroll'],['Match bank transactions','Bank','import-center'],['Review price increase alerts','Price','price-increase']]
  return <section className="rv2-info-card"><h2>Today’s Tasks</h2><div className="rv2-task-list">{tasks.map(([label,badge,key])=><button type="button" key={label} onClick={()=>setActive?.(key)}><span className="check"/><span>{label}</span><b>{badge}</b></button>)}</div></section>
}

function DetailModal({ item, onClose }) {
  if (!item) return null
  return <div className="rv2-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="rv2-modal"><header><span className={`rv2-kpi-icon rv2-kpi-icon-${item.tone}`}><Icon name={item.icon} size={20}/></span><div><h2>{item.label} Details</h2><p>Component ledger for the selected date range</p></div><button type="button" onClick={onClose}>×</button></header><div className="rv2-modal-body"><table><thead><tr><th>Component</th><th>Description</th><th>Amount</th></tr></thead><tbody>{(item.details||[]).map(row=><tr key={row.label}><td>{row.label}</td><td>{row.description}</td><td>{money(row.amount)}</td></tr>)}</tbody></table><div className="rv2-modal-total"><span>Dashboard Total</span><strong>{item.value}</strong></div></div></section></div>
}

export default function DashboardV2({ data = {}, setActive }) {
  const [start, setStart] = useState(monthStart()), [end, setEnd] = useState(today()), [applied, setApplied] = useState({start:monthStart(),end:today()}), [detail,setDetail] = useState(null)
  const metrics = useMemo(()=>{
    const salesRows=(data.salesDays||[]).filter(r=>inRange(r,applied.start,applied.end)), payrollRows=(data.payrollEntries||[]).filter(r=>inRange(r,applied.start,applied.end)), invoiceRows=(data.invoices||[]).filter(r=>inRange(r,applied.start,applied.end)), expenseRows=(data.expenses||[]).filter(r=>inRange(r,applied.start,applied.end))
    const totalSales=salesRows.reduce((s,r)=>s+first(r,['net_sales','netSales','total_sales','gross_sales','grossSales']),0), cashCollected=salesRows.reduce((s,r)=>s+first(r,['cash_sales','cashSales','cash_payments','cashPayments','actual_closeout_cash']),0)
    const payroll=payrollRows.reduce((s,r)=>s+first(r,['total_pay','final_pay','payroll_total','regular_pay','base_pay']),0), cashPayroll=payrollRows.filter(r=>String(r.payment_method||r.payroll_type||'').toLowerCase().includes('cash')).reduce((s,r)=>s+first(r,['total_pay','final_pay','payroll_total','regular_pay','base_pay']),0), checkPayroll=Math.max(0,payroll-cashPayroll)
    const vendorSpend=invoiceRows.reduce((s,r)=>s+first(r,['total','amount','invoice_total','grand_total']),0), expenses=expenseRows.reduce((s,r)=>s+first(r,['amount','total']),0)
    const foodCost=invoiceRows.filter(r=>/food|meat|produce|grocery/i.test(String(r.category||''))).reduce((s,r)=>s+first(r,['total','amount','invoice_total']),0), alcoholCost=invoiceRows.filter(r=>/beer|wine|liquor|alcohol/i.test(String(r.category||''))).reduce((s,r)=>s+first(r,['total','amount','invoice_total']),0)
    const profit=totalSales-payroll-vendorSpend-expenses, health=totalSales?Math.max(0,Math.min(100,100-((payroll+foodCost+alcoholCost+expenses)/totalSales)*65)):0, remaining=cashCollected-cashPayroll-expenses
    const daily=[...salesRows].sort((a,b)=>dateOf(a).localeCompare(dateOf(b))).slice(-15), salesTrend=daily.map(r=>first(r,['net_sales','netSales','total_sales','gross_sales','grossSales'])), cashTrend=daily.map(r=>first(r,['cash_sales','cashSales','cash_payments','cashPayments','actual_closeout_cash']))
    const fill=(arr,n=15)=>Array.from({length:n},(_,i)=>arr[i%Math.max(arr.length,1)]||0)
    return {totalSales,cashCollected,payroll,cashPayroll,checkPayroll,vendorSpend,expenses,foodCost,alcoholCost,profit,health,remaining,salesTrend:fill(salesTrend),cashTrend:fill(cashTrend)}
  },[data,applied])

  const kpis=[
    ['Total Sales',metrics.totalSales,'sales','blue','↑ 12.5%','vs previous period'],['Cash Collected',metrics.cashCollected,'cash','green','↑ 8.3%','vs previous period'],['Net Profit',metrics.profit,'profit','teal','↑ 15.2%','vs previous period'],['Restaurant Health',`${metrics.health.toFixed(0)}%`,'health','purple','↑ Good','vs last period'],
    ['Cash Payroll',metrics.cashPayroll,'payroll','lime','↓ 5.6%','vs previous period'],['Check Payroll',metrics.checkPayroll,'employees','cyan','↑ 3.2%','vs previous period'],['Vendor Spending',metrics.vendorSpend,'vendors','orange','↑ 10.1%','vs previous period'],['Business Expenses',metrics.expenses,'expenses','red','↑ 6.4%','vs previous period']
  ].map(([label,value,icon,tone,delta,compare])=>({label,value:typeof value==='string'?value:money(value),rawValue:value,icon,tone,delta,compare,details:[{label,description:'Selected period total',amount:typeof value==='number'?value:metrics.health}]}))

  return <div className="rv2-dashboard">
    <section className="rv2-dashboard-toolbar"><div className="rv2-date-range"><Icon name="calendar" size={17}/><span>{formatShort(applied.start)} – {formatShort(applied.end)}</span><b>⌄</b></div><button type="button" className="rv2-filter-button"><Icon name="filter" size={17}/>Filters</button><div className="rv2-hidden-date"><input type="date" value={start} onChange={e=>setStart(e.target.value)}/><input type="date" value={end} onChange={e=>setEnd(e.target.value)}/><button onClick={()=>setApplied({start,end})}>Apply</button></div></section>
    <section className="rv2-kpi-grid">{kpis.map(item=><KpiCard key={item.label} item={item} onOpen={setDetail}/>)}</section>
    <section className="rv2-analytics-grid"><LineChart sales={metrics.salesTrend} cash={metrics.cashTrend}/><Donut food={metrics.foodCost} alcohol={metrics.alcoholCost} beverage={metrics.vendorSpend*.15} other={metrics.expenses*.15}/><Snapshot title="Profit Snapshot" rows={[{label:'Total Sales',value:money(metrics.totalSales)},{label:'- Food Cost',value:money(metrics.foodCost)},{label:'- Alcohol Cost',value:money(metrics.alcoholCost)},{label:'- Payroll Cost',value:money(metrics.payroll)},{label:'- Operating Expenses',value:money(metrics.expenses)}]} totalLabel="Net Profit" totalValue={money(metrics.profit)} positive={metrics.profit>=0}/></section>
    <section className="rv2-lower-grid"><Snapshot title="Cash Position" rows={[{label:'Cash Collected',value:money(metrics.cashCollected)},{label:'Cash Payroll',value:money(-metrics.cashPayroll),tone:'negative'},{label:'Cash Expenses',value:money(-metrics.expenses),tone:'negative'},{label:'Vendor Cash Payments',value:money(-metrics.vendorSpend),tone:'negative'}]} totalLabel="Remaining Cash" totalValue={money(metrics.remaining)} positive={metrics.remaining>=0}/><Snapshot title="Cost Snapshot" rows={[{label:'Food Cost',value:money(metrics.foodCost)},{label:'Alcohol Cost',value:money(metrics.alcoholCost)}]} totalLabel="Total Cost" totalValue={money(metrics.foodCost+metrics.alcoholCost)}/><Tasks setActive={setActive}/></section>
    <section className="rv2-bottom-grid"><section className="rv2-info-card rv2-activity"><header><h2>Recent Activity</h2><button type="button">View All</button></header>{[['Invoice #INV-1042 paid','US Foods – $1,245.00','invoices','2h ago'],['Payroll processed','Cash payroll – $2,850.00','payroll','4h ago'],['Expense added','Maintenance Supplies – $120.00','expenses','6h ago']].map(([title,note,icon,time])=><article key={title}><span><Icon name={icon} size={16}/></span><div><strong>{title}</strong><small>{note}</small></div><time>{time}</time></article>)}</section><section className="rv2-info-card rv2-actions"><h2>Quick Actions</h2><div>{[['Import Sales','upload','sales'],['Add Invoice','invoices','invoices'],['Add Expense','expenses','expenses'],['Add Payroll','payroll','payroll'],['Add Vendor','vendors','vendors'],['Reports','reports','reports'],['Bank Reconcile','import-center','import-center'],['Price Review','price-increase','price-increase']].map(([label,icon,key])=><button type="button" key={label} onClick={()=>setActive?.(key)}><Icon name={icon} size={22}/><span>{label}</span></button>)}</div></section></section>
    <DetailModal item={detail} onClose={()=>setDetail(null)}/>
  </div>
}
