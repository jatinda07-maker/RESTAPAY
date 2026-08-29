import { BadgeDollarSign, Boxes, BriefcaseBusiness, ChartPie, CreditCard, FileInput, GlassWater, HandCoins, ReceiptText, ShoppingCart, TrendingUp, UsersRound, Utensils, WalletCards } from 'lucide-react'
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
import { useAccessControl, DEFAULT_MANAGER_DASHBOARD, DEFAULT_ADMIN_DASHBOARD } from '../lib/accessControl.js'

const displayDate = value => value || '—'

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value))
const healthBand=score=>score>=85?['Excellent','green']:score>=70?['Good','blue']:score>=55?['Watch','amber']:['Needs Attention','red']
function RestaurantHealthCard({metrics}){
  const operatingMargin=Number(metrics.operatingMargin||0)
  const primeCost=Number(metrics.primeCostPercent||0)
  const laborMix=Number(metrics.laborMixPercent||0)
  const cashRemaining=Number(metrics.cashRemaining||0)
  const reconciliation=metrics.reconciliation||{}
  const marginScore=operatingMargin>=15?25:operatingMargin>=10?21:operatingMargin>=5?15:operatingMargin>=0?9:2
  const primeScore=primeCost>0&&primeCost<=60?25:primeCost<=65?21:primeCost<=70?15:primeCost<=75?9:4
  const laborScore=laborMix>0&&laborMix<=25?20:laborMix<=30?17:laborMix<=35?12:laborMix<=40?7:3
  const cashScore=cashRemaining>=0?15:4
  const reconValues=[reconciliation.salesCategoryVariance,reconciliation.cashEquationVariance,reconciliation.profitEquationVariance].map(v=>Math.abs(Number(v||0)))
  const maxVariance=Math.max(0,...reconValues)
  const reconScore=reconciliation.balanced?15:maxVariance<=1?12:maxVariance<=25?8:4
  const score=clamp(Math.round(marginScore+primeScore+laborScore+cashScore+reconScore),0,100)
  const [label,tone]=healthBand(score)
  const checks=[
    ['Operating Margin',`${operatingMargin.toFixed(1)}%`,operatingMargin>=10?'good':operatingMargin>=5?'watch':'risk'],
    ['Prime Cost',`${primeCost.toFixed(1)}%`,primeCost<=65?'good':primeCost<=70?'watch':'risk'],
    ['Labor Mix',`${laborMix.toFixed(1)}%`,laborMix<=30?'good':laborMix<=35?'watch':'risk'],
    ['Cash Position',appMoney(cashRemaining),cashRemaining>=0?'good':'risk'],
    ['Reconciliation',reconciliation.balanced?'Balanced':maxVariance<=1?'Near balance':`Variance ${appMoney2(maxVariance)}`,reconciliation.balanced?'good':maxVariance<=1?'watch':'risk'],
  ]
  return <section className={`restaurant-health-card card-surface health-${tone}`}>
    <div className="restaurant-health-score"><div className="health-score-ring"><strong>{score}</strong><span>/100</span></div><div><span className="health-eyebrow">RESTAURANT HEALTH</span><h2>{label}</h2><p>Live score for the selected date range using profitability, prime cost, labor, cash, and reconciliation.</p></div></div>
    <div className="restaurant-health-checks">{checks.map(([name,value,state])=><div key={name} className={`health-check health-${state}`}><span>{name}</span><strong>{value}</strong></div>)}</div>
  </section>
}

export default function Dashboard() {
  const [openCard,setOpenCard]=useState(null)
  const access=useAccessControl()
  const [adminDashboard]=usePersistentState('restapay-admin-dashboard',DEFAULT_ADMIN_DASHBOARD)
  const dashboardAccess=access.isManager?{...DEFAULT_MANAGER_DASHBOARD,...(access.managerAccess?.dashboard||{})}:{...DEFAULT_ADMIN_DASHBOARD,...(adminDashboard||{})}
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
  const payrollSummary=metrics.payrollSummary||{}
  const managerOtherPayroll=Number(payrollSummary.managementPayroll||0)+Number(payrollSummary.frontOfHousePayroll||0)+Number(payrollSummary.reviewPayroll||0)
  const kitchenPayroll=Number(payrollSummary.operatingLabor||0)
  const tipsCheck=Number(payrollSummary.netTipsPaid||0)
  const kpis=[
    ['netSales',TrendingUp,'Net Sales',appMoney(metrics.salesTotal),'Selected-period restaurant sales','green'],
    ['cashSales',ShoppingCart,'Cash Sales',appMoney(metrics.cashSales),'Actual cash sales/payments','blue'],
    ['creditSales',CreditCard,'Credit Sales',appMoney(metrics.creditSales),'Card and credit sales/payments','blue'],
    ['tipsEarned',HandCoins,'Tips Earned',appMoney(metrics.tips),'Customer tips kept separate from profit','purple'],
    ['cashCollected',BriefcaseBusiness,'Cash Collected',appMoney(metrics.cashSales),'Total cash sales/payments','green'],
    ['cashFlow',WalletCards,'Cash Flow',appMoney(metrics.cashRemaining),`Cash collected ${appMoney(metrics.cashSales)}`,'green'],
    ['cashRemaining',BriefcaseBusiness,'Cash Remaining',appMoney(metrics.cashRemaining),'Cash minus cash payroll, expenses & cash invoices','teal'],
    ['primeCost',ChartPie,'Prime Cost',appPercent(metrics.primeCostPercent),`${appMoney(metrics.primeCostAmount)} • COGS + BOH/manager wages`,'blue'],
    ['operatingProfit',TrendingUp,'Operating Profit',appMoney(metrics.operatingProfit),`${appPercent(metrics.operatingMargin)} margin`,'purple'],
    ['foodCost',Utensils,'Food Cost',appPercent(metrics.foodCostPercent),`${appMoney(metrics.foodCost)} direct purchases`,'orange'],
    ['alcoholCost',GlassWater,'Alcohol Cost',appPercent(metrics.alcoholCostPercent),`${appMoney(metrics.alcoholCost)} direct purchases`,'orange'],
    ['trueFoodCost',Boxes,'True Food Cost',appMoney(metrics.trueFoodCost??metrics.foodCost),'Direct + allocated Food cost','amber'],
    ['trueAlcoholCost',GlassWater,'True Alcohol Cost',appMoney(metrics.trueAlcoholCost??metrics.alcoholCost),'Direct + allocated Alcohol cost','orange'],
    ['businessExpenses',BadgeDollarSign,'Business Expenses',appMoney(metrics.expenseTotal),'Operating expenses only • COGS/payroll excluded','red'],
    ['managerOtherPayroll',UsersRound,'Manager / GM & Other Payroll',appMoney(managerOtherPayroll),'Wages only • customer tips excluded','purple'],
    ['kitchenPayroll',ReceiptText,'Kitchen Payroll',appMoney(kitchenPayroll),'Kitchen / BOH wages only','green'],
    ['tipsCheck',HandCoins,'Tips Check - Tipped Waiters',appMoney(tipsCheck),'Net tips paid after withholding • not wage expense','orange'],
    ['laborMix',UsersRound,'Labor Mix',appPercent(metrics.laborMixPercent),`Kitchen + manager wages vs sales`,'purple'],
  ].filter(([key])=>dashboardAccess[key])
  const recentInvoices=invoices.slice(0,3).map(r=>[r.vendor||'—',r.number||r.invoice_number||'—',displayDate(r.date||r.invoice_date),appMoney2(r.amount??r.total)])
  const recentExpenses=expenses.slice(0,3).map(r=>[r.type||r.category||'—',r.vendor||'—',displayDate(r.date||r.expense_date),appMoney2(r.amount??r.total)])
  const recentPayroll=payroll.slice(0,3).map(r=>[r.employee_name||r.employee||'—',r.payment_method||r.method||'—',displayDate(r.pay_date||r.date),appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.credit_card_tips||r.tips||0)-Number(r.tip_deduction||0)+Number(r.extra_pay||0)))])
  return <div className="dashboard-page"><DateToolbar/>
    <section className="kpi-grid">{kpis.map(([,icon,title,value,subtitle,tone])=><KpiCard key={title} icon={icon} title={title} value={value} subtitle={subtitle} tone={tone} onOpen={setOpenCard}/>)}</section>
    <RestaurantHealthCard metrics={metrics}/>
    {dashboardAccess.foodAlcoholComparison&&<section className="department-comparison card-surface"><header className="department-comparison-header"><div><h2>Food vs Alcohol Cost</h2><p>Side-by-side true cost with shared-cost and manager-pay allocations</p></div><span>Allocation rules from Settings</span></header><div className="department-comparison-grid">{[
      {name:'Food',sales:departmentCosts.foodSales,direct:departmentCosts.directFoodCost,payroll:departmentCosts.kitchenPayroll,manager:departmentCosts.managerFood,shared:departmentCosts.foodSupplies+departmentCosts.foodShared,total:departmentCosts.trueFoodCost,costPct:departmentCosts.foodCostPercent,profit:departmentCosts.foodProfit,margin:departmentCosts.foodProfitMargin},
      {name:'Alcohol',sales:departmentCosts.alcoholSales,direct:departmentCosts.directAlcoholCost,payroll:departmentCosts.barPayroll,manager:departmentCosts.managerAlcohol,shared:departmentCosts.alcoholShared,total:departmentCosts.trueAlcoholCost,costPct:departmentCosts.alcoholCostPercent,profit:departmentCosts.alcoholProfit,margin:departmentCosts.alcoholProfitMargin}
    ].map(item=><article key={item.name} className="department-compare-card"><div className="department-compare-title"><h3>{item.name} Department</h3><strong>{appPercent(item.costPct)} cost</strong></div><dl><div><dt>Sales</dt><dd>{appMoney2(item.sales)}</dd></div><div><dt>Direct Purchases</dt><dd>{appMoney2(item.direct)}</dd></div><div><dt>{item.name==='Food'?'Kitchen':'Bar'} Payroll</dt><dd>{appMoney2(item.payroll)}</dd></div><div><dt>Manager Allocation <small>{departmentCosts.rules.managerPayroll?.[item.name.toLowerCase()]??0}%</small></dt><dd>{appMoney2(item.manager)}</dd></div><div><dt>Supplies + Shared Costs</dt><dd>{appMoney2(item.shared)}</dd></div><div className="department-total"><dt>True {item.name} Cost</dt><dd>{appMoney2(item.total)}</dd></div><div><dt>Profit</dt><dd>{appMoney2(item.profit)}</dd></div><div><dt>Margin</dt><dd>{appPercent(item.margin)}</dd></div></dl></article>)}</div><div className="allocation-snapshot">{[['Manager',departmentCosts.rules.managerPayroll],['Supplies',departmentCosts.rules.supplies],['Cleaning',departmentCosts.rules.cleaningSupplies],['Cintas',departmentCosts.rules.cintas],['Utilities',departmentCosts.rules.utilities],['Insurance',departmentCosts.rules.insurance],['Other',departmentCosts.rules.otherShared]].map(([label,rule])=><span key={label}><b>{label}</b> {rule?.food??0}% Food / {rule?.alcohol??0}% Alcohol</span>)}</div></section>}
    <section className="analytics-grid">{dashboardAccess.salesTrend&&<SalesTrendCard onOpen={setOpenCard} metrics={metrics} salesCount={sales.length}/>} {dashboardAccess.foodLabor&&<FoodLaborCard onOpen={setOpenCard} metrics={metrics}/>} {dashboardAccess.weeklyProfit&&<WeeklyProfitCard onOpen={setOpenCard} metrics={metrics}/>} {dashboardAccess.topVendors&&<TopVendorsCard onOpen={setOpenCard} metrics={metrics}/>}</section>
    <section className="recent-grid">
      {dashboardAccess.recentInvoices&&<RecentCard icon={FileInput} title="Recent Invoices" count={`${invoices.length} recent`} columns={['Vendor','Invoice #','Date','Total']} rows={recentInvoices} footer={invoices.length>3?`+ ${invoices.length-3} more invoices`:invoices.length?'View all invoices':'No invoice records'} to="/invoices"/>}
      {dashboardAccess.recentExpenses&&<RecentCard icon={CreditCard} title="Recent Expenses" count={`${expenses.length} recent`} columns={['Expense','Vendor','Date','Amount']} rows={recentExpenses} footer={expenses.length>3?`+ ${expenses.length-3} more expenses`:expenses.length?'View all expenses':'No expense records'} to="/expenses"/>}
      {dashboardAccess.recentPayroll&&<RecentCard icon={UsersRound} title="Recent Payroll" count={`${payroll.length} recent`} columns={['Employee','Type','Date','Amount']} rows={recentPayroll} footer={payroll.length>3?`+ ${payroll.length-3} more payroll`:payroll.length?'View all payroll':'No payroll records'} to="/payroll"/>}
      {dashboardAccess.quickAccess&&<QuickAccessCard/>}
    </section><footer className="app-footer"><span>© 2026 RestaPay. All rights reserved.</span><span>Version 1.0.0</span></footer><DetailDrawer title={openCard} onClose={()=>setOpenCard(null)}/>
  </div>
}
