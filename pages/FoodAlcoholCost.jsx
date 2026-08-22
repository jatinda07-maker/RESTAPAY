import { useMemo, useState } from 'react'
import { Beef, ChevronRight, CircleDollarSign, PackageSearch, Scale, ShoppingBasket, Wine, X } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import usePersistentState from '../hooks/usePersistentState'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

const isAlcohol = row => /alcohol|beer|wine|liquor|margarita|cocktail|shot/i.test(String(row.category||row.department||''))
const isFood = row => !isAlcohol(row) && /food|meat|seafood|produce|dairy|dry goods|frozen/i.test(String(row.category||row.department||''))
const amountOf = row => Number(row.line_total ?? row.amount ?? row.total ?? row.final_pay ?? row.regular_pay ?? 0) || 0
const dateOf = row => row.date || row.invoice_date || row.pay_date || row.payroll_date || row.shift_date || '—'

function buildCategoryRows(sourceRows, predicate, fallbackLabel){
  const selected=sourceRows.filter(predicate)
  const map=new Map()
  selected.forEach(row=>{
    const category=row.category||row.department||fallbackLabel
    const current=map.get(category)||{count:0,amount:0,vendors:new Map(),invoices:new Set()}
    const amount=amountOf(row)
    current.count+=1
    current.amount+=amount
    current.invoices.add(row.invoice_id||row.id)
    const vendor=row.vendor||row.vendor_name||'Unassigned'
    current.vendors.set(vendor,(current.vendors.get(vendor)||0)+amount)
    map.set(category,current)
  })
  const total=selected.reduce((sum,row)=>sum+amountOf(row),0)
  return {
    selected,
    rows:[...map.entries()].map(([category,item])=>{
      const top=[...item.vendors.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||'—'
      return [category,`${item.count} line${item.count===1?'':'s'} · ${item.invoices.size} invoice${item.invoices.size===1?'':'s'}`,appMoney2(item.amount),appPercent(total?item.amount/total*100:0),top]
    })
  }
}

function EntryDrawer({detail,onClose}){
  if(!detail) return null
  const rows=detail.rows||[]
  const components=detail.components||[]
  const total=rows.reduce((sum,row)=>sum+amountOf(row),0)
  const sourceCount=components.reduce((sum,item)=>sum+(item.rows?.length||0),0)
  const derived=components.length>0
  return <div className="cost-detail-layer" onMouseDown={onClose}>
    <aside className="cost-detail-drawer" onMouseDown={event=>event.stopPropagation()}>
      <header><div><span>{detail.department} Department</span><h2>{detail.title}</h2><p>{detail.subtitle||(derived?'Calculation components for the selected period':'Included line entries for the selected period')}</p></div><button type="button" onClick={onClose} aria-label="Close details"><X size={20}/></button></header>
      <div className="cost-detail-total"><span>{derived?`${components.length} components · ${sourceCount} source records`:`${rows.length} entr${rows.length===1?'y':'ies'}`}</span><strong>{appMoney2(detail.summaryAmount ?? total)}</strong></div>
      <div className="cost-detail-scroll">
        {derived ? components.map((item,index)=><div className="cost-detail-entry cost-detail-component" key={`${item.label}-${index}`}>
          <span><strong>{item.label}</strong><small>{item.meta||`${item.rows?.length||0} source record${item.rows?.length===1?'':'s'}`}</small></span>
          <b>{appMoney2(item.amount||0)}</b>
        </div>) : rows.length ? rows.map((row,index)=><div className="cost-detail-entry" key={`${row.id||row.invoice_id||index}-${index}`}>
          <span><strong>{row.employee_name||row.vendor||row.vendor_name||row.description||row.category||'Entry'}</strong><small>{dateOf(row)} · {row.job_type||row.job||row.category||row.department||row.invoice_number||'Record'}</small></span>
          <b>{appMoney2(amountOf(row))}</b>
        </div>) : <div className="cost-detail-empty">No matching source records are available for this amount.</div>}
      </div>
    </aside>
  </div>
}

function DepartmentCard({name,icon:Icon,costs,onAmount}){
  const food=name==='Food'
  const key=name.toLowerCase()
  const values=food?{
    sales:costs.foodSales,direct:costs.directFoodCost,payroll:costs.kitchenPayroll,manager:costs.managerFood,
    supplies:costs.foodSupplies,shared:costs.foodShared,total:costs.trueFoodCost,pct:costs.foodCostPercent,
    profit:costs.foodProfit,margin:costs.foodProfitMargin,payrollLabel:'Kitchen Payroll'
  }:{
    sales:costs.alcoholSales,direct:costs.directAlcoholCost,payroll:costs.barPayroll,manager:costs.managerAlcohol,
    supplies:costs.alcoholSupplies||0,shared:costs.alcoholShared,total:costs.trueAlcoholCost,pct:costs.alcoholCostPercent,
    profit:costs.alcoholProfit,margin:costs.alcoholProfitMargin,payrollLabel:'Bar Payroll'
  }
  const rule=costs.rules?.managerPayroll||{}
  const Row=({label,amount,type,meta,total=false})=><div className={total?'cost-compare-total':''}><dt>{label}{meta&&<small>{meta}</small>}</dt><dd><button type="button" className="cost-amount-link" onClick={()=>onAmount(name,type,amount)}>{appMoney2(amount)}</button></dd></div>
  return <article className={`cost-compare-card cost-compare-${key}`}>
    <header><div className="cost-compare-name"><span><Icon size={19}/></span><div><h3>{name} Department</h3><small>Full allocated department economics</small></div></div><strong>{appPercent(values.pct)} cost</strong></header>
    <dl>
      <Row label="Department Sales" amount={values.sales} type="sales"/>
      <Row label="Direct Purchases" amount={values.direct} type="direct"/>
      <Row label={values.payrollLabel} amount={values.payroll} type="payroll"/>
      <Row label="Manager Allocation" amount={values.manager} type="manager" meta={`${rule?.[key]??0}%`}/>
      <Row label="Supplies Allocation" amount={values.supplies} type="supplies" meta={`${costs.rules?.supplies?.[key]??0}%`}/>
      <Row label="Cleaning / Cintas / Utilities / Insurance / Other" amount={values.shared} type="shared"/>
      <Row label={`True ${name} Cost`} amount={values.total} type="true-cost" total/>
      <Row label="Profit" amount={values.profit} type="profit"/>
      <div><dt>Margin</dt><dd className="cost-data-value">{appPercent(values.margin)}</dd></div>
    </dl>
  </article>
}

function BreakdownTable({name,rows,selected,purchase,onCategory}){
  return <div className={`cost-table-card cost-breakdown-card cost-breakdown-${name.toLowerCase()}`}>
    <div className="cost-section-title"><div><h3>{name} Purchase Breakdown</h3><span>Invoice totals and purchase mix</span></div><PackageSearch size={20}/></div>
    <div className="cost-table-scroll"><table className="cost-table"><colgroup><col className="cost-col-category"/><col className="cost-col-activity"/><col className="cost-col-amount"/><col className="cost-col-mix"/><col className="cost-col-vendor"/></colgroup><thead><tr><th>Category</th><th>Activity</th><th className="numeric">Amount</th><th className="numeric">Mix</th><th>Top Vendor</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row[0]}>{row.map((cell,index)=><td key={index} className={index===2||index===3?'numeric':''}>{index===2?<button type="button" className="cost-amount-link" onClick={()=>onCategory(name,row[0])}>{cell}</button>:cell}</td>)}</tr>):<tr><td colSpan="5" className="empty-table-cell">No {name.toLowerCase()} invoice records</td></tr>}</tbody><tfoot><tr><td>Total {name}</td><td>{selected.length} line{selected.length===1?'':'s'}</td><td className="numeric"><button type="button" className="cost-amount-link" onClick={()=>onCategory(name,null)}>{appMoney2(purchase)}</button></td><td className="numeric">{selected.length?'100.0%':'0.0%'}</td><td>—</td></tr></tfoot></table></div>
  </div>
}

export default function FoodAlcoholCost(){
  const [detail,setDetail]=useState(null)
  const {sales,invoices,expenses,payroll,employees,metrics}=useAppData()
  const [costSettings]=usePersistentState('restapay-cost-settings',{departmentAllocations:DEFAULT_ALLOCATION_RULES})
  const sourceRows=useMemo(()=>{
    const lineRows=(metrics.normalizedInvoices||[]).flatMap(invoice=>(invoice.lines||[]).map(line=>({...line,vendor:invoice.vendor,invoice_id:invoice.id,invoice_number:invoice.number,invoice_date:invoice.date,category:line.category||invoice.category,amount:line.line_total,total:line.line_total})))
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
  const payrollRowsFor=(department,type)=>payroll.filter(row=>{
    const text=String(`${row.job_type||row.job||''} ${row.employee_name||''}`).toLowerCase()
    if(type==='manager') return /general manager|restaurant manager|store manager|\bmanager\b|management/.test(text) && !/assistant manager|assistant mgr|asst\.? manager|asistente manager/.test(text)
    if(department==='Food') return /kitchen|cook|chef|prep|dishwasher|dish washer|line cook|food prep/.test(text)
    return /bartender|barback|bar manager/.test(text)
  })
  const sharedRows=useMemo(()=>[...sourceRows,...expenses].filter(row=>/suppl|clean|cintas|linen|utilit|insurance|electric|water|gas|sewer|internet|other/i.test(String(`${row.category||''} ${row.description||''} ${row.vendor||row.vendor_name||''}`))),[sourceRows,expenses])

  const openAmount=(department,type,summaryAmount)=>{
    const food=department==='Food'
    let rows=[]; let title=''; let components=[]
    const directRows=food?foodBreakdown.selected:alcoholBreakdown.selected
    const laborRows=payrollRowsFor(department,'payroll')
    const managerRows=payrollRowsFor(department,'manager')
    const supplyRows=sharedRows.filter(row=>/suppl|paper|glove|container|napkin|packag|smallware|utensil|disposable/i.test(String(`${row.category||''} ${row.description||''}`)))
    const salesRows=sales.filter(food?isFood:isAlcohol)
    const directAmount=food?departmentCosts.directFoodCost:departmentCosts.directAlcoholCost
    const laborAmount=food?departmentCosts.kitchenPayroll:departmentCosts.barPayroll
    const managerAmount=food?departmentCosts.managerFood:departmentCosts.managerAlcohol
    const suppliesAmount=food?departmentCosts.foodSupplies:(departmentCosts.alcoholSupplies||0)
    const sharedAmount=food?departmentCosts.foodShared:departmentCosts.alcoholShared
    const salesAmount=food?departmentCosts.foodSales:departmentCosts.alcoholSales
    if(type==='sales'){ rows=salesRows; title='Department Sales' }
    else if(type==='direct'){ rows=directRows; title='Direct Purchases' }
    else if(type==='payroll'){ rows=laborRows; title=food?'Kitchen Payroll':'Bar Payroll' }
    else if(type==='manager'){ rows=managerRows; title='Manager Allocation' }
    else if(type==='supplies'){ rows=supplyRows; title='Supplies Allocation' }
    else if(type==='shared'){ rows=sharedRows; title='Shared Operating Costs' }
    else if(type==='true-cost'){
      title=`True ${department} Cost`
      components=[
        {label:'Direct Purchases',amount:directAmount,rows:directRows},
        {label:food?'Kitchen / BOH Payroll':'Alcohol / Bar Payroll',amount:laborAmount,rows:laborRows},
        {label:'Manager Allocation',amount:managerAmount,rows:managerRows,meta:`${departmentCosts.rules?.managerPayroll?.[department.toLowerCase()]??0}% allocation · ${managerRows.length} source records`},
        {label:'Supplies Allocation',amount:suppliesAmount,rows:supplyRows,meta:`${departmentCosts.rules?.supplies?.[department.toLowerCase()]??0}% allocation · ${supplyRows.length} source records`},
        {label:'Shared Operating Costs',amount:sharedAmount,rows:sharedRows},
      ]
    }
    else if(type==='profit'){
      title=`${department} Profit`
      components=[
        {label:`${department} Sales`,amount:salesAmount,rows:salesRows},
        {label:'Direct Purchases',amount:-directAmount,rows:directRows},
        {label:food?'Kitchen / BOH Payroll':'Alcohol / Bar Payroll',amount:-laborAmount,rows:laborRows},
        {label:'Manager Allocation',amount:-managerAmount,rows:managerRows},
        {label:'Supplies Allocation',amount:-suppliesAmount,rows:supplyRows},
        {label:'Shared Operating Costs',amount:-sharedAmount,rows:sharedRows},
      ]
    }
    setDetail({department,title,rows,components,summaryAmount})
  }
  const openCategory=(department,category)=>{
    const selected=department==='Food'?foodBreakdown.selected:alcoholBreakdown.selected
    const rows=category?selected.filter(row=>String(row.category||row.department||'')===String(category)):selected
    setDetail({department,title:category?`${category} Entries`:`${department} Purchase Entries`,rows})
  }

  return <div className="cost-page"><DateToolbar/>
    <section className="cost-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=>{const department=/alcohol/i.test(title)?'Alcohol':'Food';const type=/profit/i.test(title)?'profit':'true-cost';return <button key={title} className={`cost-kpi cost-tone-${tone}`} onClick={()=>openAmount(department,type,Number(String(value).replace(/[^0-9.-]/g,''))||0)}><span className="cost-kpi-icon"><Icon size={23}/></span><span className="cost-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight className="cost-kpi-arrow" size={18}/></button>})}</section>
    <section className="cost-workspace card-surface"><header className="cost-header"><div><h2>Food & Alcohol Cost Detail</h2><p>Full department cost comparison including purchases, payroll, manager allocation, and shared operating costs</p></div><div className="cost-header-summary"><span><CircleDollarSign size={17}/>Combined True Cost</span><strong>{appMoney(departmentCosts.trueFoodCost+departmentCosts.trueAlcoholCost)}</strong></div></header>
      <div className="cost-compare-grid"><DepartmentCard name="Food" icon={ShoppingBasket} costs={departmentCosts} onAmount={openAmount}/><DepartmentCard name="Alcohol" icon={Wine} costs={departmentCosts} onAmount={openAmount}/></div>
      <div className="cost-allocation-strip">{allocationRows.map(([label,rule])=><span key={label}><b>{label}</b>{rule?.food??0}% Food / {rule?.alcohol??0}% Alcohol</span>)}</div>
      <div className="cost-breakdown-grid"><BreakdownTable name="Food" rows={foodBreakdown.rows} selected={foodBreakdown.selected} purchase={departmentCosts.directFoodCost} onCategory={openCategory}/><BreakdownTable name="Alcohol" rows={alcoholBreakdown.rows} selected={alcoholBreakdown.selected} purchase={departmentCosts.directAlcoholCost} onCategory={openCategory}/></div>
    </section>
    <EntryDrawer detail={detail} onClose={()=>setDetail(null)}/>
  </div>
}
