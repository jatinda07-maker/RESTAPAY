import { useMemo, useState } from 'react'
import { Beef, ChevronRight, CircleDollarSign, PackageSearch, Scale, ShoppingBasket, Wine } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import DetailDrawer from '../components/DetailDrawer'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import usePersistentState from '../hooks/usePersistentState'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

const isAlcohol = row => /alcohol|beer|wine|liquor|margarita|cocktail|shot/i.test(String(row.category||row.department||''))
const isFood = row => !isAlcohol(row) && /food|meat|seafood|produce|dairy|dry goods|frozen/i.test(String(row.category||row.department||''))

function buildCategoryRows(sourceRows, predicate, fallbackLabel){
  const selected=sourceRows.filter(predicate)
  const map=new Map()
  selected.forEach(row=>{
    const category=row.category||row.department||fallbackLabel
    const current=map.get(category)||{count:0,amount:0,vendors:new Map(),invoices:new Set()}
    const amount=Number(row.line_total??row.amount??row.total??0)||0
    current.count+=1
    current.amount+=amount
    current.invoices.add(row.invoice_id||row.id)
    const vendor=row.vendor||'Unassigned'
    current.vendors.set(vendor,(current.vendors.get(vendor)||0)+amount)
    map.set(category,current)
  })
  const total=selected.reduce((sum,row)=>sum+(Number(row.line_total??row.amount??row.total??0)||0),0)
  return {
    selected,
    rows:[...map.entries()].map(([category,item])=>{
      const top=[...item.vendors.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
      return [category,`${item.count} line${item.count===1?'':'s'} · ${item.invoices.size} invoice${item.invoices.size===1?'':'s'}`,appMoney2(item.amount),appPercent(total?item.amount/total*100:0),top]
    })
  }
}

function DepartmentCard({name,icon:Icon,costs}){
  const food=name==='Food'
  const key=name.toLowerCase()
  const values=food?{
    sales:costs.foodSales,
    direct:costs.directFoodCost,
    payroll:costs.kitchenPayroll,
    manager:costs.managerFood,
    supplies:costs.foodSupplies,
    shared:costs.foodShared,
    total:costs.trueFoodCost,
    pct:costs.foodCostPercent,
    profit:costs.foodProfit,
    margin:costs.foodProfitMargin,
    payrollLabel:'Kitchen Payroll'
  }:{
    sales:costs.alcoholSales,
    direct:costs.directAlcoholCost,
    payroll:costs.barPayroll,
    manager:costs.managerAlcohol,
    supplies:0,
    shared:costs.alcoholShared,
    total:costs.trueAlcoholCost,
    pct:costs.alcoholCostPercent,
    profit:costs.alcoholProfit,
    margin:costs.alcoholProfitMargin,
    payrollLabel:'Bar Payroll'
  }
  const rule=costs.rules?.managerPayroll||{}
  return <article className={`cost-compare-card cost-compare-${key}`}>
    <header><div className="cost-compare-name"><span><Icon size={19}/></span><div><h3>{name} Department</h3><small>Full allocated department economics</small></div></div><strong>{appPercent(values.pct)} cost</strong></header>
    <dl>
      <div><dt>Department Sales</dt><dd>{appMoney2(values.sales)}</dd></div>
      <div><dt>Direct Purchases</dt><dd>{appMoney2(values.direct)}</dd></div>
      <div><dt>{values.payrollLabel}</dt><dd>{appMoney2(values.payroll)}</dd></div>
      <div><dt>Manager Allocation <small>{rule?.[key]??0}%</small></dt><dd>{appMoney2(values.manager)}</dd></div>
      {food&&<div><dt>Supplies Allocation <small>{costs.rules?.supplies?.food??0}%</small></dt><dd>{appMoney2(values.supplies)}</dd></div>}
      <div><dt>Cleaning / Cintas / Utilities / Insurance / Other</dt><dd>{appMoney2(values.shared)}</dd></div>
      <div className="cost-compare-total"><dt>True {name} Cost</dt><dd>{appMoney2(values.total)}</dd></div>
      <div><dt>Profit</dt><dd>{appMoney2(values.profit)}</dd></div>
      <div><dt>Margin</dt><dd>{appPercent(values.margin)}</dd></div>
    </dl>
  </article>
}

function BreakdownTable({name,rows,selected,purchase}){
  return <div className="cost-table-card"><div className="cost-section-title"><div><h3>{name} Purchase Breakdown</h3><span>Invoice totals and purchase mix</span></div><PackageSearch size={20}/></div><div className="cost-table-scroll"><table className="cost-table"><colgroup><col className="cost-col-category"/><col className="cost-col-activity"/><col className="cost-col-amount"/><col className="cost-col-mix"/><col className="cost-col-vendor"/></colgroup><thead><tr><th>Category</th><th>Activity</th><th className="numeric">Amount</th><th className="numeric">Mix</th><th>Top Vendor</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row[0]}>{row.map((cell,index)=><td key={index} className={index===2||index===3?'numeric':''}>{cell}</td>)}</tr>):<tr><td colSpan="5" className="empty-table-cell">No {name.toLowerCase()} invoice records</td></tr>}</tbody><tfoot><tr><td>Total {name}</td><td>{selected.length} line{selected.length===1?'':'s'}</td><td className="numeric">{appMoney2(purchase)}</td><td className="numeric">{selected.length?'100.0%':'0.0%'}</td><td>—</td></tr></tfoot></table></div></div>
}

export default function FoodAlcoholCost(){
  const [drawer,setDrawer]=useState(null)
  const {sales,invoices,expenses,payroll,employees,metrics}=useAppData()
  const [costSettings]=usePersistentState('restapay-cost-settings',{departmentAllocations:DEFAULT_ALLOCATION_RULES})
  const sourceRows=useMemo(()=>{
    const lineRows=(metrics.normalizedInvoices||[]).flatMap(invoice=>(invoice.lines||[]).map(line=>({...line,vendor:invoice.vendor,invoice_id:invoice.id,invoice_number:invoice.number,category:line.category||invoice.category,amount:line.line_total,total:line.line_total})))
    return lineRows.length?lineRows:invoices
  },[invoices,metrics.normalizedInvoices])
  const foodBreakdown=useMemo(()=>buildCategoryRows(sourceRows,isFood,'Food'),[sourceRows])
  const alcoholBreakdown=useMemo(()=>buildCategoryRows(sourceRows,isAlcohol,'Alcohol'),[sourceRows])
  const departmentCosts=useMemo(()=>{
    const invoiceSpend=invoices.flatMap(invoice=>{
      const lines=Array.isArray(invoice.lines)?invoice.lines:[]
      if(lines.length) return lines.map(line=>({...line,vendor:invoice.vendor,vendor_name:invoice.vendor,category:line.category||invoice.category,_source_table:'invoice_items'}))
      return [{...invoice,amount:invoice.amount??invoice.total,_source_table:'invoices'}]
    })
    const expenseSpend=expenses.map(row=>({...row,_source_table:'expenses'}))
    return calculateDepartmentCosts({salesRows:sales,payrollRows:payroll,employees,spendRows:[...invoiceSpend,...expenseSpend],settings:costSettings||{}})
  },[sales,invoices,expenses,payroll,employees,costSettings])

  const cards=[
    {title:'True Food Cost',value:appMoney(departmentCosts.trueFoodCost),meta:`${appPercent(departmentCosts.foodCostPercent)} of ${appMoney(departmentCosts.foodSales)} food sales`,tone:'green',icon:Beef},
    {title:'True Alcohol Cost',value:appMoney(departmentCosts.trueAlcoholCost),meta:`${appPercent(departmentCosts.alcoholCostPercent)} of ${appMoney(departmentCosts.alcoholSales)} alcohol sales`,tone:'blue',icon:Wine},
    {title:'Food Profit',value:appMoney(departmentCosts.foodProfit),meta:`${appPercent(departmentCosts.foodProfitMargin)} department margin`,tone:'orange',icon:ShoppingBasket},
    {title:'Alcohol Profit',value:appMoney(departmentCosts.alcoholProfit),meta:`${appPercent(departmentCosts.alcoholProfitMargin)} department margin`,tone:'purple',icon:Scale},
  ]
  const allocationRows=[['Manager',departmentCosts.rules?.managerPayroll],['Supplies',departmentCosts.rules?.supplies],['Cleaning',departmentCosts.rules?.cleaningSupplies],['Cintas',departmentCosts.rules?.cintas],['Utilities',departmentCosts.rules?.utilities],['Insurance',departmentCosts.rules?.insurance],['Other',departmentCosts.rules?.otherShared]]

  return <div className="cost-page"><DateToolbar/>
    <section className="cost-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=><button key={title} className={`cost-kpi cost-tone-${tone}`} onClick={()=>setDrawer(title)}><span className="cost-kpi-icon"><Icon size={23}/></span><span className="cost-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight className="cost-kpi-arrow" size={18}/></button>)}</section>
    <section className="cost-workspace card-surface"><header className="cost-header"><div><h2>Food & Alcohol Cost Detail</h2><p>Full department cost comparison including purchases, payroll, manager allocation, and shared operating costs</p></div><div className="cost-header-summary"><span><CircleDollarSign size={17}/>Combined True Cost</span><strong>{appMoney(departmentCosts.trueFoodCost+departmentCosts.trueAlcoholCost)}</strong></div></header>
      <div className="cost-compare-grid"><DepartmentCard name="Food" icon={ShoppingBasket} costs={departmentCosts}/><DepartmentCard name="Alcohol" icon={Wine} costs={departmentCosts}/></div>
      <div className="cost-allocation-strip">{allocationRows.map(([label,rule])=><span key={label}><b>{label}</b>{rule?.food??0}% Food / {rule?.alcohol??0}% Alcohol</span>)}</div>
      <div className="cost-breakdown-grid"><BreakdownTable name="Food" rows={foodBreakdown.rows} selected={foodBreakdown.selected} purchase={departmentCosts.directFoodCost}/><BreakdownTable name="Alcohol" rows={alcoholBreakdown.rows} selected={alcoholBreakdown.selected} purchase={departmentCosts.directAlcoholCost}/></div>
    </section><DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/></div>
}
