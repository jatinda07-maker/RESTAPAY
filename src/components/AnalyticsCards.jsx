import { ChevronRight, ShoppingCart, Store, TrendingUp, UtensilsCrossed } from 'lucide-react'
import { appMoney, appPercent } from '../hooks/useAppData'

function SummaryRow({ label, value, meta }) {
  return <div className="summary-row"><div className="summary-row-copy"><strong>{label}</strong>{meta ? <span>{meta}</span> : null}</div><b>{value}</b></div>
}
function SummaryCard({ icon:Icon,title,subtitle,tone,children,footerLabel,footerValue,onOpen }) {
  return <button type="button" className={`summary-card card-surface summary-${tone}`} onClick={()=>onOpen?.(title)}>
    <div className="summary-accent"/><div className="summary-card-header"><div className="summary-card-title"><span className="summary-card-icon"><Icon size={22}/></span><div className="summary-card-heading"><h3>{title}</h3><span>{subtitle}</span></div></div></div>
    <div className="summary-card-body">{children}</div><div className="summary-card-footer"><span>{footerLabel}</span><span className="summary-footer-value"><strong>{footerValue}</strong><ChevronRight size={18}/></span></div>
  </button>
}
export function SalesTrendCard({onOpen,metrics,salesCount=0}) { return <SummaryCard onOpen={onOpen} icon={ShoppingCart} title="Sales Summary" subtitle={`${salesCount} sales entries`} tone="blue" footerLabel="Total Sales" footerValue={appMoney(metrics.salesTotal)}>
  <SummaryRow label="Food Sales" value={appMoney(metrics.foodSales)} meta={`${appPercent(metrics.salesTotal ? metrics.foodSales/metrics.salesTotal*100 : 0)} of sales`}/>
  <SummaryRow label="Alcohol Sales" value={appMoney(metrics.alcoholSales)} meta="Beer, liquor and wine"/><SummaryRow label="Other Sales" value={appMoney(metrics.otherSales)} meta="Service and miscellaneous"/>
</SummaryCard> }
export function FoodLaborCard({onOpen,metrics}) { return <SummaryCard onOpen={onOpen} icon={UtensilsCrossed} title="Cost Breakdown" subtitle="Current period totals" tone="orange" footerLabel="Prime Cost" footerValue={appMoney(metrics.primeCostAmount)}>
  <SummaryRow label="Food Cost" value={appMoney(metrics.foodCost)} meta={`${appPercent(metrics.foodCostPercent)} of food sales`}/><SummaryRow label="Alcohol Cost" value={appMoney(metrics.alcoholCost)} meta={`${appPercent(metrics.alcoholCostPercent)} of alcohol sales`}/><SummaryRow label="Operating Labor" value={appMoney(metrics.operatingLabor)} meta={`${appPercent(metrics.laborMixPercent)} of sales · employee tips excluded`}/><SummaryRow label="Tip Pass-Through" value={appMoney(metrics.netTipsPaid)} meta="Employee-owned tips excluded from Prime Cost"/>
</SummaryCard> }
export function WeeklyProfitCard({onOpen,metrics}) { return <SummaryCard onOpen={onOpen} icon={TrendingUp} title="Profit Summary" subtitle="Income and deductions" tone="green" footerLabel="Operating Profit" footerValue={appMoney(metrics.operatingProfit)}>
  <SummaryRow label="Gross Sales" value={appMoney(metrics.salesTotal)} meta="Before expenses"/><SummaryRow label="Cost of Goods" value={appMoney(-metrics.cogs)} meta="Food and alcohol"/><SummaryRow label="Operating Labor & Expenses" value={appMoney(-(metrics.operatingLabor+metrics.expenseTotal))} meta="Employee tips excluded"/>
</SummaryCard> }
export function TopVendorsCard({onOpen,metrics}) { const rows=metrics.topVendors.length?metrics.topVendors:[['No vendor data',0]]; return <SummaryCard onOpen={onOpen} icon={Store} title="Vendor Spend" subtitle={`${metrics.topVendors.length} vendor entries`} tone="purple" footerLabel="Vendor Total" footerValue={appMoney(metrics.invoiceTotal)}>
  {rows.map(([name,value])=><SummaryRow key={name} label={name} value={appMoney(value)} meta={value ? 'Invoice spend' : 'No invoices'}/>) }
</SummaryCard> }
