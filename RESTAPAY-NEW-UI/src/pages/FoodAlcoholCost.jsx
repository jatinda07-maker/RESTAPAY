import { useMemo, useState } from 'react'
import { Beef, Beer, ChevronRight, CircleDollarSign, PackageSearch, Scale, ShoppingBasket, Wine } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import DetailDrawer from '../components/DetailDrawer'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'

const isAlcohol = row => /alcohol|beer|wine|liquor|margarita|cocktail|shot/i.test(String(row.category||row.department||''))
const isFood = row => !isAlcohol(row) && /food|meat|seafood|produce|dairy|dry goods|frozen/i.test(String(row.category||row.department||''))

export default function FoodAlcoholCost(){
  const [drawer,setDrawer]=useState(null),[tab,setTab]=useState('Food')
  const {invoices,metrics}=useAppData()
  const sourceRows=useMemo(()=>{
    const lineRows=(metrics.normalizedInvoices||[]).flatMap(invoice=>(invoice.lines||[]).map(line=>({...line,vendor:invoice.vendor,invoice_id:invoice.id,invoice_number:invoice.number,category:line.category||invoice.category,amount:line.line_total,total:line.line_total})))
    return lineRows.length?lineRows:invoices
  },[invoices,metrics.normalizedInvoices])
  const selected=tab==='Food'?sourceRows.filter(isFood):sourceRows.filter(isAlcohol)
  const rows=useMemo(()=>{
    const map=new Map()
    selected.forEach(row=>{const category=row.category||row.department||tab;const current=map.get(category)||{count:0,amount:0,vendors:new Map(),invoices:new Set()};const amount=Number(row.line_total??row.amount??row.total??0)||0;current.count+=1;current.amount+=amount;current.invoices.add(row.invoice_id||row.id);const vendor=row.vendor||'Unassigned';current.vendors.set(vendor,(current.vendors.get(vendor)||0)+amount);map.set(category,current)})
    const total=selected.reduce((sum,row)=>sum+(Number(row.line_total??row.amount??row.total??0)||0),0)
    return [...map.entries()].map(([category,item])=>{const top=[...item.vendors.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';return [category,`${item.count} line${item.count===1?'':'s'} · ${item.invoices.size} invoice${item.invoices.size===1?'':'s'}`,appMoney2(item.amount),appPercent(total?item.amount/total*100:0),top]})
  },[selected,tab])
  const purchase=tab==='Food'?metrics.foodCost:metrics.alcoholCost
  const departmentSales=tab==='Food'?metrics.foodSales:metrics.alcoholSales
  const costPercent=tab==='Food'?metrics.foodCostPercent:metrics.alcoholCostPercent
  const cards=[
    {title:'Food Purchases',value:appMoney(metrics.foodCost),meta:`${metrics.foodInvoiceCount} invoices · selected period`,tone:'orange',icon:ShoppingBasket},
    {title:'Alcohol Purchases',value:appMoney(metrics.alcoholCost),meta:`${metrics.alcoholInvoiceCount} invoices · selected period`,tone:'purple',icon:Wine},
    {title:'True Food Cost',value:appPercent(metrics.foodCostPercent),meta:`${appMoney(metrics.foodCost)} ÷ ${appMoney(metrics.foodSales)} food sales`,tone:'green',icon:Beef},
    {title:'True Alcohol Cost',value:appPercent(metrics.alcoholCostPercent),meta:`${appMoney(metrics.alcoholCost)} ÷ ${appMoney(metrics.alcoholSales)} alcohol sales`,tone:'blue',icon:Beer},
  ]
  return <div className="cost-page"><DateToolbar/>
    <section className="cost-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=><button key={title} className={`cost-kpi cost-tone-${tone}`} onClick={()=>setDrawer(title)}><span className="cost-kpi-icon"><Icon size={23}/></span><span className="cost-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight className="cost-kpi-arrow" size={18}/></button>)}</section>
    <section className="cost-workspace card-surface"><header className="cost-header"><div><h2>Food & Alcohol Cost Detail</h2><p>Purchases, invoice counts, category mix, and true-cost calculations</p></div><div className="cost-header-summary"><span><CircleDollarSign size={17}/>Combined Purchases</span><strong>{appMoney(metrics.cogs)}</strong></div></header>
      <nav className="cost-tabs"><button className={tab==='Food'?'active':''} onClick={()=>setTab('Food')}><ShoppingBasket size={16}/>Food</button><button className={tab==='Alcohol'?'active':''} onClick={()=>setTab('Alcohol')}><Wine size={16}/>Alcohol</button></nav>
      <div className="cost-content-grid"><div className="cost-table-card"><div className="cost-section-title"><div><h3>{tab} Category Breakdown</h3><span>Invoice totals and purchase mix</span></div><PackageSearch size={20}/></div><div className="cost-table-scroll"><table className="cost-table"><colgroup><col className="cost-col-category"/><col className="cost-col-activity"/><col className="cost-col-amount"/><col className="cost-col-mix"/><col className="cost-col-vendor"/></colgroup><thead><tr><th>Category</th><th>Activity</th><th className="numeric">Amount</th><th className="numeric">Mix</th><th>Top Vendor</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row[0]}>{row.map((cell,index)=><td key={index} className={index===2||index===3?'numeric':''}>{cell}</td>)}</tr>):<tr><td colSpan="5" className="empty-table-cell">No {tab.toLowerCase()} invoice records</td></tr>}</tbody><tfoot><tr><td>Total {tab}</td><td>{selected.length} line{selected.length===1?'':'s'}</td><td className="numeric">{appMoney2(purchase)}</td><td className="numeric">{selected.length?'100.0%':'0.0%'}</td><td>—</td></tr></tfoot></table></div></div>
        <aside className="cost-insight-card"><div className="cost-insight-icon"><Scale size={23}/></div><h3>True Cost Snapshot</h3><p>Compares actual department purchases against matching Toast department sales.</p><div className="cost-metric"><span>Department Sales</span><strong>{appMoney(departmentSales)}</strong></div><div className="cost-metric"><span>Purchases</span><strong>{appMoney(purchase)}</strong></div><div className="cost-metric emphasis"><span>True Cost</span><strong>{appPercent(costPercent)}</strong></div><button onClick={()=>setDrawer(tab==='Food'?'True Food Cost':'True Alcohol Cost')}>View calculation details<ChevronRight size={17}/></button></aside>
      </div>
    </section><DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/></div>
}
