import { BadgeDollarSign, Boxes, BriefcaseBusiness, ChartPie, CreditCard, FileInput, GlassWater, ShoppingCart, TrendingUp, UsersRound, Utensils, WalletCards } from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import KpiCard from '../components/KpiCard'
import { FoodLaborCard, SalesTrendCard, TopVendorsCard, WeeklyProfitCard } from '../components/AnalyticsCards'
import RecentCard from '../components/RecentCard'
import QuickAccessCard from '../components/QuickAccessCard'
import DetailDrawer from '../components/DetailDrawer'
import { useState } from 'react'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'

const displayDate = value => value || '—'
export default function Dashboard() {
  const [openCard,setOpenCard]=useState(null)
  const {sales,invoices,expenses,payroll,metrics}=useAppData()
  const kpis=[
    [WalletCards,'Cash Flow',appMoney(metrics.cashRemaining),`Cash collected ${appMoney(metrics.cashSales)}`,'green'],
    [ChartPie,'Prime Cost',appPercent(metrics.primeCostPercent),'Food + alcohol + payroll vs sales','blue'],
    [UsersRound,'Labor Mix',appPercent(metrics.laborMixPercent),`Cash ${appMoney(metrics.cashPayroll)} • Check ${appMoney(metrics.checkPayroll)}`,'purple'],
    [Utensils,'Food Cost',appPercent(metrics.foodCostPercent),`${appMoney(metrics.foodCost)} purchases`,'orange'],
    [ShoppingCart,'Cash Sales',appMoney(metrics.cashSales),'Actual cash sales/payments','blue'],
    [BriefcaseBusiness,'Cash Collected',appMoney(metrics.cashSales),'Total cash sales/payments','green'],
    [TrendingUp,'Operating Profit',appMoney(metrics.operatingProfit),`${appPercent(metrics.operatingMargin)} margin`,'purple'],
    [BriefcaseBusiness,'Cash Remaining',appMoney(metrics.cashRemaining),'Cash minus cash payroll, expenses & cash invoices','teal'],
    [Boxes,'True Food Cost',appMoney(metrics.foodCost),'Actual food invoice totals','amber'],
    [GlassWater,'True Alcohol Cost',appMoney(metrics.alcoholCost),'Beer • liquor • wine','orange'],
    [BadgeDollarSign,'Business Expenses',appMoney(metrics.expenseTotal),'Operating expenses','red'],
    [UsersRound,'Payroll Total',appMoney(metrics.payrollTotal),'Cash • Check payroll','blue'],
  ]
  const recentInvoices=invoices.slice(0,3).map(r=>[r.vendor||'—',r.number||r.invoice_number||'—',displayDate(r.date||r.invoice_date),appMoney2(r.amount??r.total)])
  const recentExpenses=expenses.slice(0,3).map(r=>[r.type||r.category||'—',r.vendor||'—',displayDate(r.date||r.expense_date),appMoney2(r.amount??r.total)])
  const recentPayroll=payroll.slice(0,3).map(r=>[r.employee_name||r.employee||'—',r.payment_method||r.method||'—',displayDate(r.pay_date||r.date),appMoney2((Number(r.regular_pay||r.base_pay||0)+Number(r.credit_card_tips||r.tips||0)-Number(r.tip_deduction||0)+Number(r.extra_pay||0)))])
  return <div className="dashboard-page"><DateToolbar/>
    <section className="kpi-grid">{kpis.map(([icon,title,value,subtitle,tone])=><KpiCard key={title} icon={icon} title={title} value={value} subtitle={subtitle} tone={tone} onOpen={setOpenCard}/>)}</section>
    <section className="analytics-grid"><SalesTrendCard onOpen={setOpenCard} metrics={metrics} salesCount={sales.length}/><FoodLaborCard onOpen={setOpenCard} metrics={metrics}/><WeeklyProfitCard onOpen={setOpenCard} metrics={metrics}/><TopVendorsCard onOpen={setOpenCard} metrics={metrics}/></section>
    <section className="recent-grid">
      <RecentCard icon={FileInput} title="Recent Invoices" count={`${invoices.length} recent`} columns={['Vendor','Invoice #','Date','Total']} rows={recentInvoices} footer={invoices.length>3?`+ ${invoices.length-3} more invoices`:invoices.length?'View all invoices':'No invoice records'} to="/invoices"/>
      <RecentCard icon={CreditCard} title="Recent Expenses" count={`${expenses.length} recent`} columns={['Expense','Vendor','Date','Amount']} rows={recentExpenses} footer={expenses.length>3?`+ ${expenses.length-3} more expenses`:expenses.length?'View all expenses':'No expense records'} to="/expenses"/>
      <RecentCard icon={UsersRound} title="Recent Payroll" count={`${payroll.length} recent`} columns={['Employee','Type','Date','Amount']} rows={recentPayroll} footer={payroll.length>3?`+ ${payroll.length-3} more payroll`:payroll.length?'View all payroll':'No payroll records'} to="/payroll"/>
      <QuickAccessCard/>
    </section><footer className="app-footer"><span>© 2026 RestaPay. All rights reserved.</span><span>Version 1.0.0</span></footer><DetailDrawer title={openCard} onClose={()=>setOpenCard(null)}/>
  </div>
}
