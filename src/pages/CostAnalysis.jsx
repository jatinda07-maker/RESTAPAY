import React, { useMemo, useState } from 'react'
import DateControls from '../components/DateControls'
import { calculateDepartmentCosts, num } from '../engine/DepartmentCostEngine'

function money(value) { return `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function pct(value) { return `${Number(value || 0).toFixed(1)}%` }
function rowDate(row = {}) { return String(row.business_date || row.pay_date || row.payroll_date || row.invoice_date || row.expense_date || row.date || row.created_at || '').slice(0, 10) }
function inRange(row, start, end) { const date = rowDate(row); if (!date) return true; return !(start && date < start) && !(end && date > end) }
function invoiceAmount(row = {}) { return num(row.line_total ?? row.total ?? row.amount ?? row.invoice_total) }
function iso(date) { return date.toISOString().slice(0, 10) }
function presetRange(key) {
  const now = new Date()
  if (key === 'today') return { start: iso(now), end: iso(now) }
  if (key === 'lastWeek') { const end = new Date(now); end.setDate(now.getDate() - (now.getDay() || 7)); const start = new Date(end); start.setDate(end.getDate() - 6); return { start: iso(start), end: iso(end) } }
  if (key === 'lastMonth') return { start: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
  if (key === 'thisMonth') return { start: iso(new Date(now.getFullYear(), now.getMonth(), 1)), end: iso(now) }
  return { start: '', end: '' }
}

function sumRows(rows, key = 'amount') { return rows.reduce((sum, row) => sum + Number(row[key] ?? row.amount ?? row.salesAmount ?? 0), 0) }

function DrilldownModal({ detail, onClose }) {
  if (!detail) return null
  const total = detail.total ?? sumRows(detail.rows || [], detail.amountKey)
  return <div className="cost-modal-backdrop" onMouseDown={onClose}>
    <section className="cost-modal" onMouseDown={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={detail.title}>
      <header><div><h2>{detail.title}</h2><p>{detail.subtitle || 'Items included in the selected total.'}</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button></header>
      <div className="cost-modal-total"><span>Clicked total</span><strong>{detail.percent ? pct(total) : money(total)}</strong></div>
      <div className="table-scroll"><table>
        <thead><tr>{detail.columns.map(column => <th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{detail.rows?.length ? detail.rows.map((row, index) => <tr key={row.id || `${detail.title}-${index}`}>{detail.columns.map(column => <td key={column.key}>{column.render ? column.render(row) : String(row[column.key] ?? '-')}</td>)}</tr>) : <tr><td colSpan={detail.columns.length}>No matching rows in this date range.</td></tr>}</tbody>
        <tfoot><tr><td colSpan={Math.max(1, detail.columns.length - 1)}><b>Subtotal</b></td><td><b>{detail.percent ? pct(total) : money(total)}</b></td></tr></tfoot>
      </table></div>
      {detail.expected !== undefined && Math.abs(Number(detail.expected) - Number(total)) > 0.01 ? <div className="cost-reconcile-warning">Subtotal does not match the selected total. Difference: {money(Number(detail.expected) - Number(total))}</div> : <div className="cost-reconcile-ok">Subtotal matches the selected total.</div>}
    </section>
  </div>
}

function SummaryRow({ label, value, onClick, className = '', note = '' }) {
  return <button type="button" className={`cost-summary-row ${className}`.trim()} onClick={onClick}>
    <span><b>{label}</b>{note ? <small>{note}</small> : null}</span><strong>{value}</strong><i aria-hidden="true">›</i>
  </button>
}

export default function CostAnalysis({ data }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [detail, setDetail] = useState(null)

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
      return { ...row, date: rowDate(row) || rowDate(parent), vendor: parent.vendor || parent.vendor_name || row.vendor || row.vendor_name, vendor_name: parent.vendor_name || parent.vendor || row.vendor_name || row.vendor, description: row.description || row.item_name || row.name, category: row.category || parent.category, amount: invoiceAmount(row) }
    })
    const headerSpend = invoices.filter(row => !itemInvoiceIds.has(row.id)).map(row => ({ ...row, date: rowDate(row), vendor: row.vendor || row.vendor_name, description: row.invoice_number || row.notes || row.category, amount: invoiceAmount(row) }))
    const expenses = (data.expenses || []).filter(row => inRange(row, start, end)).map(row => ({ ...row, date: rowDate(row), vendor: row.vendor || row.name, description: row.notes || row.name || row.category, amount: num(row.amount) }))
    const menuItems = (data.menuItems || []).filter(row => inRange(row, start, end))
    return calculateDepartmentCosts({ salesRows, payrollRows, employees: data.employees || [], spendRows: [...itemSpend, ...headerSpend, ...expenses], menuItems, settings: data.settings || {} })
  }, [data, start, end])

  const classifiedSales = derived.foodSales + derived.alcoholSales
  const foodShare = classifiedSales > 0 ? derived.foodSales / classifiedSales * 100 : 0
  const alcoholShare = classifiedSales > 0 ? derived.alcoholSales / classifiedSales * 100 : 0
  const managerRowsFood = (derived.payrollDetails.manager || []).map(row => ({ ...row, amount: row.foodAllocated }))
  const managerRowsAlcohol = (derived.payrollDetails.manager || []).map(row => ({ ...row, amount: row.alcoholAllocated }))
  const alcoholPurchaseRows = [...(derived.spendDetails.beer || []), ...(derived.spendDetails.liquor || []), ...(derived.spendDetails.margaritaMix || [])]
  const sharedFoodRows = derived.spendDetails.sharedFood || []
  const sharedAlcoholRows = derived.spendDetails.sharedAlcohol || []

  const salesColumns = [{ key: 'category', label: 'Toast Sales Category' }, { key: 'items', label: 'Items', render: row => Number(row.itemCount || row.items || 0).toLocaleString() }, { key: 'amount', label: 'Net Sales', render: row => money(row.salesAmount ?? row.amount) }]
  const costColumns = [{ key: 'date', label: 'Date', render: row => rowDate(row) || '-' }, { key: 'vendor', label: 'Vendor / Employee', render: row => row.vendor || row.vendor_name || row.employee_name || row.name || '-' }, { key: 'description', label: 'Item / Classification', render: row => row.description || row.item_name || row.costLabel || row.payrollLabel || row.category || '-' }, { key: 'amount', label: 'Amount', render: row => money(row.allocatedAmount ?? row.amount ?? 0) }]
  const componentColumns = [{ key: 'label', label: 'Component' }, { key: 'amount', label: 'Amount', render: row => money(row.amount) }]

  const openSales = (type) => {
    const rows = type === 'food' ? derived.foodDepartmentRows : derived.alcoholDepartmentRows
    const expected = type === 'food' ? derived.foodSales : derived.alcoholSales
    setDetail({ title: `${type === 'food' ? 'Food' : 'Alcohol'} Sales Details`, subtitle: `${derived.salesSource}.`, rows, columns: salesColumns, amountKey: 'salesAmount', total: expected, expected })
  }
  const openCost = (title, rows, expected, amountKey = 'amount') => setDetail({ title, rows, columns: costColumns, amountKey, total: expected, expected })
  const openComponents = (title, rows, expected) => setDetail({ title, rows, columns: componentColumns, amountKey: 'amount', total: expected, expected })

  return <div className="cost-analysis-page">
    <div className="page-head cost-analysis-head"><div><h1>Food & Alcohol Cost</h1><p>Department sales, purchases, payroll allocations, shared costs, and profit reconciliation.</p></div></div>
    <DateControls start={start} end={end} onStartChange={setStart} onEndChange={setEnd} onApply={() => {}} onPreset={key => { const range = presetRange(key); setStart(range.start); setEnd(range.end) }} applyLabel="Apply" />

    <section className="sales-mix-banner"><div><span>Sales Mix</span><strong>{derived.foodSales >= derived.alcoholSales ? 'Food sales were higher' : 'Alcohol sales were higher'}</strong><small>{money(Math.abs(derived.foodSales - derived.alcoholSales))} difference in the selected period</small></div><div className="sales-mix-values"><span><b>{money(derived.foodSales)}</b><small>{pct(foodShare)} Food</small></span><span><b>{money(derived.alcoholSales)}</b><small>{pct(alcoholShare)} Alcohol</small></span></div></section>

    <div className="cost-page-grid">
      <section className="cost-department-card food-cost-card"><header><h2>Food Department</h2><span>{pct(derived.foodCostPercent)} cost</span></header><div className="cost-summary-list">
        <SummaryRow label="Food Sales" value={money(derived.foodSales)} note="Food + No Sales Category Assigned" onClick={() => openSales('food')} />
        <SummaryRow label="Food Purchases" value={money(derived.foodPurchases)} onClick={() => openCost('Food Purchase Details', derived.spendDetails.food || [], derived.foodPurchases)} />
        <SummaryRow label="Kitchen Payroll" value={money(derived.kitchenPayroll)} onClick={() => openCost('Kitchen Payroll Details', derived.payrollDetails.kitchen || [], derived.kitchenPayroll)} />
        <SummaryRow label="Manager Allocation" value={money(derived.managerFood)} onClick={() => openCost('Manager Allocation — Food', managerRowsFood, derived.managerFood)} />
        <SummaryRow label="Shared Supplies / Cintas / Utilities" value={money(derived.foodSupplies + derived.foodShared)} onClick={() => openCost('Shared Costs — Food', sharedFoodRows, derived.foodSupplies + derived.foodShared, 'allocatedAmount')} />
        <SummaryRow className="cost-total" label="True Food Cost" value={money(derived.trueFoodCost)} onClick={() => openComponents('True Food Cost Components', [{ label: 'Food Purchases', amount: derived.foodPurchases }, { label: 'Kitchen Payroll', amount: derived.kitchenPayroll }, { label: 'Manager Allocation', amount: derived.managerFood }, { label: 'Shared Costs', amount: derived.foodSupplies + derived.foodShared }], derived.trueFoodCost)} />
        <SummaryRow className="cost-profit" label="Food Profit" value={money(derived.foodProfit)} note={`${pct(derived.foodProfitMargin)} margin`} onClick={() => openComponents('Food Profit Reconciliation', [{ label: 'Food Sales', amount: derived.foodSales }, { label: 'Less: True Food Cost', amount: -derived.trueFoodCost }, { label: 'Food Profit', amount: derived.foodProfit }], derived.foodProfit)} />
      </div></section>

      <section className="cost-department-card alcohol-cost-card"><header><h2>Alcohol Department</h2><span>{pct(derived.alcoholCostPercent)} cost</span></header><div className="cost-summary-list">
        <SummaryRow label="Alcohol Sales" value={money(derived.alcoholSales)} note="Beer, cocktails, draft, margaritas and wine" onClick={() => openSales('alcohol')} />
        <SummaryRow label="Beer Purchases" value={money(derived.beerPurchases)} onClick={() => openCost('Beer Purchase Details', derived.spendDetails.beer || [], derived.beerPurchases)} />
        <SummaryRow label="Liquor / Wine Purchases" value={money(derived.liquorPurchases)} onClick={() => openCost('Liquor / Wine Purchase Details', derived.spendDetails.liquor || [], derived.liquorPurchases)} />
        <SummaryRow label="Margarita Mix" value={money(derived.margaritaMix)} onClick={() => openCost('Margarita Mix Details', derived.spendDetails.margaritaMix || [], derived.margaritaMix)} />
        <SummaryRow label="Manager Allocation" value={money(derived.managerAlcohol)} onClick={() => openCost('Manager Allocation — Alcohol', managerRowsAlcohol, derived.managerAlcohol)} />
        <SummaryRow label="Bar Payroll" value={money(derived.barPayroll)} onClick={() => openCost('Bar Payroll Details', derived.payrollDetails.bar || [], derived.barPayroll)} />
        <SummaryRow label="Shared Supplies / Cintas / Utilities" value={money(derived.alcoholShared)} onClick={() => openCost('Shared Costs — Alcohol', sharedAlcoholRows, derived.alcoholShared, 'allocatedAmount')} />
        <SummaryRow className="cost-total" label="True Alcohol Cost" value={money(derived.trueAlcoholCost)} onClick={() => openComponents('True Alcohol Cost Components', [{ label: 'Beer Purchases', amount: derived.beerPurchases }, { label: 'Liquor / Wine Purchases', amount: derived.liquorPurchases }, { label: 'Margarita Mix', amount: derived.margaritaMix }, { label: 'Manager Allocation', amount: derived.managerAlcohol }, { label: 'Bar Payroll', amount: derived.barPayroll }, { label: 'Shared Costs', amount: derived.alcoholShared }], derived.trueAlcoholCost)} />
        <SummaryRow className="cost-profit" label="Alcohol Profit" value={money(derived.alcoholProfit)} note={`${pct(derived.alcoholProfitMargin)} margin`} onClick={() => openComponents('Alcohol Profit Reconciliation', [{ label: 'Alcohol Sales', amount: derived.alcoholSales }, { label: 'Less: True Alcohol Cost', amount: -derived.trueAlcoholCost }, { label: 'Alcohol Profit', amount: derived.alcoholProfit }], derived.alcoholProfit)} />
      </div></section>
    </div>

    <section className="cost-reconciliation-strip"><span>Toast Net Sales</span><b>{money(derived.netSales)}</b><span>Food + Alcohol</span><b>{money(classifiedSales)}</b><span>Excluded / Other</span><b>{money(derived.excludedDepartmentSales + derived.otherDepartmentSales)}</b><span>Difference</span><b className={Math.abs(derived.departmentSalesDifference - derived.excludedDepartmentSales - derived.otherDepartmentSales) < 0.02 ? 'ok' : 'warn'}>{money(derived.netSales - classifiedSales - derived.excludedDepartmentSales - derived.otherDepartmentSales)}</b></section>
    <DrilldownModal detail={detail} onClose={() => setDetail(null)} />
  </div>
}
