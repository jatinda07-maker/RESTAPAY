import { BadgeDollarSign, Boxes, BriefcaseBusiness, ChartPie, CreditCard, FileInput, GlassWater, ShoppingCart, TrendingUp, UsersRound, Utensils, WalletCards } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import KpiCard from '../components/KpiCard'
import { FoodLaborCard, SalesTrendCard, TopVendorsCard, WeeklyProfitCard } from '../components/AnalyticsCards'
import RecentCard from '../components/RecentCard'
import QuickAccessCard from '../components/QuickAccessCard'
import DetailDrawer from '../components/DetailDrawer'
import { useMemo, useState } from 'react'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import usePersistentState from '../hooks/usePersistentState'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

const displayDate = value => value || '—'
export default function Dashboard() {
  const [openCard,setOpenCard]=useState(null)
  const {sales,invoices,expenses,payroll,employees,metrics}=useAppData()
  const [costSettings]=usePersistentState('restapay-cost-settings',{departmentAllocations:DEFAULT_ALLOCATION_RULES})
  const departmentCosts=useMemo(()=>{
    const invoiceSpend=invoices.flatMap(invoice=>{
      const lines=Array.isArray(invoice.lines)?invoice.lines:[]
      if(lines.length) return lines.map(line=>({...line,vendor:invoice.vendor,vendor_name:invoice.vendor,category:line.category||invoice.category,_source_table:'invoice_items'}))
      return [{...invoice,amount:invoice.amount??invoice.total,_source_table:'invoices'}]
    })
    const expenseSpend=expenses.map(row=>({...row,_source_table:'expenses'}))
    return calculateDepartmentCosts({salesRows:sales,payrollRows:payroll,employees,spendRows:[...invoiceSpend,...expenseSpend],settings:costSettings||{}})
  },[sales,invoices,expenses,payroll,employees,costSettings])
  const kpis=[
    [WalletCards,'Cash Flow',appMoney(metrics.cashRemaining),`Cash collected ${appMoney(metrics.cashSales)}`,'green'],
    [ChartPie,'Prime Cost',appPercent(metrics.primeCostPercent),'Food + alcohol + operating labor vs sales','blue'],
    [UsersRound,'Labor Mix',appPercent(metrics.laborMixPercent),`BOH operating labor ${appMoney(metrics.operatingLabor)} · tips excluded`,'purple'],
    [Utensils,'Food Cost',appPercent(departmentCosts.foodCostPercent),`${appMoney(departmentCosts.trueFoodCost)} true department cost`,'orange'],
    [ShoppingCart,'Cash Sales',appMoney(metrics.cashSales),'Actual cash sales/payments','blue'],
    [BriefcaseBusiness,'Cash Collected',appMoney(metrics.cashSales),'Total cash sales/payments','green'],
    [TrendingUp,'Operating Profit',appMoney(metrics.operatingProfit),`${appPercent(metrics.operatingMargin)} margin`,'purple'],
    [BriefcaseBusiness,'Cash Remaining',appMoney(metrics.cashRemaining),'Cash minus cash payroll, expenses & cash invoices','teal'],
    [Boxes,'True Food Cost',appMoney(departmentCosts.trueFoodCost),'Purchases + allocated payroll/shared costs','amber'],
    [GlassWater,'True Alcohol Cost',appMoney(departmentCosts.trueAlcoholCost),'Purchases + allocated payroll/shared costs','orange'],
    [BadgeDollarSign,'Business Expenses',appMoney(metrics.expenseTotal),'Operating expenses','red'],
    [UsersRound,'Payroll Total',appMoney(metrics.payrollTotal),'Cash • Check payroll','blue'],
  ]
  const recentInvoices=invoices.slice(0,3).map(r=>[r.vendor||'—',r.number||r.invoice_number||'—',displayDate(r.date||r.invoice_date),appMoney2(r.amount??r.total)])
  const recentExpenses=expenses.slice(0,3).map(r=>[r.type||r.category||'—',r.vendor||'—',displayDate(r.date||r.expense_date),appMoney2(r.amount??r.total)])
  const recentPayroll=payroll.slice(0,3).map(r=>[r.employee_name||r.employee||'—',r.payment_method||r.method||'—',displayDate(r.pay_date||r.date),appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.credit_card_tips||r.tips||0)-Number(r.tip_deduction||0)+Number(r.extra_pay||0)))])
  return <div className="dashboard-page"><DateToolbar/>
    <section className="kpi-grid">{kpis.map(([icon,title,value,subtitle,tone])=><KpiCard key={title} icon={icon} title={title} value={value} subtitle={subtitle} tone={tone} onOpen={setOpenCard}/>)}</section>
    <section className="department-comparison card-surface"><header className="department-comparison-header"><div><h2>Food vs Alcohol Cost</h2><p>Side-by-side true cost with shared-cost and manager-pay allocations</p></div><span>Allocation rules from Settings</span></header><div className="department-comparison-grid">{[
      {name:'Food',sales:departmentCosts.foodSales,direct:departmentCosts.directFoodCost,payroll:departmentCosts.kitchenPayroll,manager:departmentCosts.managerFood,shared:departmentCosts.foodSupplies+departmentCosts.foodShared,total:departmentCosts.trueFoodCost,costPct:departmentCosts.foodCostPercent,profit:departmentCosts.foodProfit,margin:departmentCosts.foodProfitMargin},
      {name:'Alcohol',sales:departmentCosts.alcoholSales,direct:departmentCosts.directAlcoholCost,payroll:departmentCosts.barPayroll,manager:departmentCosts.managerAlcohol,shared:departmentCosts.alcoholShared,total:departmentCosts.trueAlcoholCost,costPct:departmentCosts.alcoholCostPercent,profit:departmentCosts.alcoholProfit,margin:departmentCosts.alcoholProfitMargin}
    ].map(item=><article key={item.name} className="department-compare-card"><div className="department-compare-title"><h3>{item.name} Department</h3><strong>{appPercent(item.costPct)} cost</strong></div><dl><div><dt>Sales</dt><dd>{appMoney2(item.sales)}</dd></div><div><dt>Direct Purchases</dt><dd>{appMoney2(item.direct)}</dd></div><div><dt>{item.name==='Food'?'Kitchen':'Bar'} Payroll</dt><dd>{appMoney2(item.payroll)}</dd></div><div><dt>Manager Allocation <small>{departmentCosts.rules.managerPayroll?.[item.name.toLowerCase()]??0}%</small></dt><dd>{appMoney2(item.manager)}</dd></div><div><dt>Supplies + Shared Costs</dt><dd>{appMoney2(item.shared)}</dd></div><div className="department-total"><dt>True {item.name} Cost</dt><dd>{appMoney2(item.total)}</dd></div><div><dt>Profit</dt><dd>{appMoney2(item.profit)}</dd></div><div><dt>Margin</dt><dd>{appPercent(item.margin)}</dd></div></dl></article>)}</div><div className="allocation-snapshot">{[['Manager',departmentCosts.rules.managerPayroll],['Supplies',departmentCosts.rules.supplies],['Cleaning',departmentCosts.rules.cleaningSupplies],['Cintas',departmentCosts.rules.cintas],['Utilities',departmentCosts.rules.utilities],['Insurance',departmentCosts.rules.insurance],['Other',departmentCosts.rules.otherShared]].map(([label,rule])=><span key={label}><b>{label}</b> {rule?.food??0}% Food / {rule?.alcohol??0}% Alcohol</span>)}</div></section>
    <section className="analytics-grid"><SalesTrendCard onOpen={setOpenCard} metrics={metrics} salesCount={sales.length}/><FoodLaborCard onOpen={setOpenCard} metrics={metrics}/><WeeklyProfitCard onOpen={setOpenCard} metrics={metrics}/><TopVendorsCard onOpen={setOpenCard} metrics={metrics}/></section>
    <section className="recent-grid">
      <RecentCard icon={FileInput} title="Recent Invoices" count={`${invoices.length} recent`} columns={['Vendor','Invoice #','Date','Total']} rows={recentInvoices} footer={invoices.length>3?`+ ${invoices.length-3} more invoices`:invoices.length?'View all invoices':'No invoice records'} to="/invoices"/>
      <RecentCard icon={CreditCard} title="Recent Expenses" count={`${expenses.length} recent`} columns={['Expense','Vendor','Date','Amount']} rows={recentExpenses} footer={expenses.length>3?`+ ${expenses.length-3} more expenses`:expenses.length?'View all expenses':'No expense records'} to="/expenses"/>
      <RecentCard icon={UsersRound} title="Recent Payroll" count={`${payroll.length} recent`} columns={['Employee','Type','Date','Amount']} rows={recentPayroll} footer={payroll.length>3?`+ ${payroll.length-3} more payroll`:payroll.length?'View all payroll':'No payroll records'} to="/payroll"/>
      <QuickAccessCard/>
    </section><footer className="app-footer"><span>© 2026 RestaPay. All rights reserved.</span><span>Version 1.0.0</span></footer><DetailDrawer title={openCard} onClose={()=>setOpenCard(null)}/>
  </div>
}
