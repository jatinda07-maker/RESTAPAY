import React, { useMemo, useState } from 'react'
import { calculateDepartmentCosts, menuSaleCategoryLabel, num } from '../engine/DepartmentCostEngine'

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function rowDate(row = {}) {
  return String(row.business_date || row.pay_date || row.payroll_date || row.invoice_date || row.expense_date || row.date || row.created_at || '').slice(0, 10)
}
function inRange(row, start, end) {
  const date = rowDate(row)
  if (!date) return true
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}
function invoiceAmount(row = {}) { return num(row.line_total ?? row.total ?? row.amount ?? row.invoice_total) }

function DetailTable({ title, rows, amountKey = 'amount', amountLabel = 'Amount', empty = 'No matching details.' }) {
  const total = rows.reduce((sum, row) => sum + Number(row[amountKey] ?? row.amount ?? 0), 0)
  return <section className="cost-detail-card">
    <header><h3>{title}</h3><strong>{money(total)}</strong></header>
    <div className="table-scroll"><table>
      <thead><tr><th>Date</th><th>Vendor / Employee</th><th>Item / Classification</th><th>{amountLabel}</th></tr></thead>
      <tbody>
        {rows.length ? rows.map((row, index) => <tr key={row.id || `${title}-${index}`}>
          <td>{rowDate(row) || '-'}</td>
          <td>{row.vendor || row.vendor_name || row.employee_name || row.name || '-'}</td>
          <td>{row.description || row.item_name || row.costLabel || row.payrollLabel || row.category || '-'}</td>
          <td>{money(row[amountKey] ?? row.amount ?? 0)}</td>
        </tr>) : <tr><td colSpan="4">{empty}</td></tr>}
      </tbody>
      <tfoot><tr><td colSpan="3"><b>Subtotal</b></td><td><b>{money(total)}</b></td></tr></tfoot>
    </table></div>
  </section>
}

export default function CostAnalysis({ data }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const derived = useMemo(() => {
    const salesRows = (data.salesDays || []).filter(row => inRange(row, start, end))
    const payrollRows = (data.payrollEntries || []).filter(row => inRange(row, start, end))
    const invoices = (data.invoices || []).filter(row => inRange(row, start, end))
    const invoiceById = Object.fromEntries((data.invoices || []).map(row => [row.id, row]))
    const invoiceItems = (data.invoiceItems || []).filter(row => {
      const parent = invoiceById[row.invoice_id] || {}
      return inRange({ ...parent, ...row, date: rowDate(row) || rowDate(parent) }, start, end)
    })
    const itemInvoiceIds = new Set(invoiceItems.map(row => row.invoice_id).filter(Boolean))
    const itemSpend = invoiceItems.map(row => {
      const parent = invoiceById[row.invoice_id] || {}
      return {
        ...row,
        date: rowDate(row) || rowDate(parent),
        vendor: parent.vendor || parent.vendor_name || row.vendor || row.vendor_name,
        vendor_name: parent.vendor_name || parent.vendor || row.vendor_name || row.vendor,
        description: row.description || row.item_name || row.name,
        category: row.category || parent.category,
        amount: invoiceAmount(row)
      }
    })
    const headerSpend = invoices.filter(row => !itemInvoiceIds.has(row.id)).map(row => ({
      ...row,
      date: rowDate(row),
      vendor: row.vendor || row.vendor_name,
      description: row.invoice_number || row.notes || row.category,
      amount: invoiceAmount(row)
    }))
    const expenses = (data.expenses || []).filter(row => inRange(row, start, end)).map(row => ({
      ...row,
      date: rowDate(row),
      vendor: row.vendor || row.name,
      description: row.notes || row.name || row.category,
      amount: num(row.amount)
    }))
    const menuItems = (data.menuItems || []).filter(row => inRange(row, start, end))
    const spendRows = [...itemSpend, ...headerSpend, ...expenses]
    return calculateDepartmentCosts({
      salesRows,
      payrollRows,
      employees: data.employees || [],
      spendRows,
      menuItems,
      settings: data.settings || {}
    })
  }, [data, start, end])

  const classifiedSales = derived.foodSales + derived.alcoholSales
  const foodShare = classifiedSales > 0 ? derived.foodSales / classifiedSales * 100 : 0
  const alcoholShare = classifiedSales > 0 ? derived.alcoholSales / classifiedSales * 100 : 0
  const managerRowsFood = (derived.payrollDetails.manager || []).map(row => ({ ...row, amount: row.foodAllocated }))
  const managerRowsAlcohol = (derived.payrollDetails.manager || []).map(row => ({ ...row, amount: row.alcoholAllocated }))
  const alcoholPurchaseRows = [
    ...(derived.spendDetails.beer || []),
    ...(derived.spendDetails.liquor || []),
    ...(derived.spendDetails.margaritaMix || [])
  ]

  return <div className="cost-analysis-page">
    <div className="page-head cost-analysis-head"><div><h1>Food & Alcohol Cost</h1><p>Department sales, purchases, payroll allocations, shared costs, and profit reconciliation.</p></div>
      <div className="cost-date-controls"><label>From<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>To<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label><button className="btn secondary" type="button" onClick={() => { setStart(''); setEnd('') }}>All Dates</button></div>
    </div>

    <section className="sales-mix-banner">
      <div><span>Sales Mix</span><strong>{derived.foodSales >= derived.alcoholSales ? 'Food sales were higher' : 'Alcohol sales were higher'}</strong><small>{money(Math.abs(derived.foodSales - derived.alcoholSales))} difference in the selected period</small></div>
      <div className="sales-mix-values"><span><b>{money(derived.foodSales)}</b><small>{pct(foodShare)} Food</small></span><span><b>{money(derived.alcoholSales)}</b><small>{pct(alcoholShare)} Alcohol</small></span></div>
    </section>

    <div className="cost-page-grid">
      <section className="cost-department-card food-cost-card">
        <header><h2>Food Department</h2><span>{pct(derived.foodCostPercent)} cost</span></header>
        <div className="cost-summary-list">
          <div><span>Food Sales</span><b>{money(derived.foodSales)}</b></div>
          <div><span>Food Purchases</span><b>{money(derived.foodPurchases)}</b></div>
          <div><span>Kitchen Payroll</span><b>{money(derived.kitchenPayroll)}</b></div>
          <div><span>Manager Allocation</span><b>{money(derived.managerFood)}</b></div>
          <div><span>Shared Supplies / Cintas / Utilities</span><b>{money(derived.foodSupplies + derived.foodShared)}</b></div>
          <div className="cost-total"><span>True Food Cost</span><b>{money(derived.trueFoodCost)}</b></div>
          <div className="cost-profit"><span>Food Profit</span><b>{money(derived.foodProfit)}</b><small>{pct(derived.foodProfitMargin)} margin</small></div>
        </div>
      </section>

      <section className="cost-department-card alcohol-cost-card">
        <header><h2>Alcohol Department</h2><span>{pct(derived.alcoholCostPercent)} cost</span></header>
        <div className="cost-summary-list">
          <div><span>Alcohol Sales</span><b>{money(derived.alcoholSales)}</b></div>
          <div><span>Beer Purchases</span><b>{money(derived.beerPurchases)}</b></div>
          <div><span>Liquor / Wine Purchases</span><b>{money(derived.liquorPurchases)}</b></div>
          <div><span>Margarita Mix</span><b>{money(derived.margaritaMix)}</b></div>
          <div><span>Manager Allocation</span><b>{money(derived.managerAlcohol)}</b></div>
          <div><span>Bar Payroll</span><b>{money(derived.barPayroll)}</b></div>
          <div><span>Shared Supplies / Cintas / Utilities</span><b>{money(derived.alcoholShared)}</b></div>
          <div className="cost-total"><span>True Alcohol Cost</span><b>{money(derived.trueAlcoholCost)}</b></div>
          <div className="cost-profit"><span>Alcohol Profit</span><b>{money(derived.alcoholProfit)}</b><small>{pct(derived.alcoholProfitMargin)} margin</small></div>
        </div>
      </section>
    </div>

    <div className="cost-details-grid">
      <DetailTable title="Food Purchase Details" rows={derived.spendDetails.food || []} />
      <DetailTable title="Alcohol Purchase Details" rows={alcoholPurchaseRows} />
      <DetailTable title="Kitchen Payroll" rows={derived.payrollDetails.kitchen || []} />
      <DetailTable title="Manager Allocation — Food" rows={managerRowsFood} />
      <DetailTable title="Manager Allocation — Alcohol" rows={managerRowsAlcohol} />
      <DetailTable title="Bar Payroll" rows={derived.payrollDetails.bar || []} />
      <DetailTable title="Shared Costs — Food" rows={derived.spendDetails.sharedFood || []} amountKey="allocatedAmount" />
      <DetailTable title="Shared Costs — Alcohol" rows={derived.spendDetails.sharedAlcohol || []} amountKey="allocatedAmount" />
    </div>

    <section className="cost-sales-detail-card">
      <header><h3>Department Sales Details</h3><strong>{money(classifiedSales)}</strong></header>
      <div className="table-scroll"><table><thead><tr><th>Department</th><th>Category</th><th>Item</th><th>Qty Sold</th><th>Net Sales</th></tr></thead><tbody>
        {[...(derived.foodSalesRows || []), ...(derived.alcoholSalesRows || [])].map((row, index) => <tr key={row.id || index}><td>{row.department === 'alcohol' ? 'Alcohol' : 'Food'}</td><td>{menuSaleCategoryLabel(row)}</td><td>{row.name || row.item_name || row.description || '-'}</td><td>{num(row.qtySold || row.qty_sold || row.quantity)}</td><td>{money(row.salesAmount)}</td></tr>)}
      </tbody><tfoot><tr><td colSpan="4"><b>Classified Sales Total</b></td><td><b>{money(classifiedSales)}</b></td></tr></tfoot></table></div>
    </section>
  </div>
}
