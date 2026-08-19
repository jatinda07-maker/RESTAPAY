import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'
import { buildFinancialMetrics } from '../core/engines/FinancialReconciliation.js'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

import { liveSnapshot, subscribeLiveData, connectLiveData, reconcileLiveData, getLiveSetting } from '../data/liveDataStore.js'
import useGlobalDateRange, { inDateRange, normalizeRowDate } from './useGlobalDateRange.js'

const number = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0

const freshRows = rows => Array.isArray(rows) ? rows.filter(Boolean).map(row=>({...row})) : []
function snapshot(){ const value=liveSnapshot()||{};return {sales:freshRows(value.sales),payroll:freshRows(value.payroll),invoices:freshRows(value.invoices),expenses:freshRows(value.expenses),vendors:freshRows(value.vendors),employees:freshRows(value.employees),payRates:freshRows(value.payRates),invoiceApprovals:freshRows(value.invoiceApprovals),cashLedger:freshRows(value.cashLedger)} }

export function useAppData(overrideRange = null) {
  const { range: globalRange } = useGlobalDateRange()
  const range = overrideRange?.from && overrideRange?.to ? overrideRange : globalRange
  const [data, setData] = useState(snapshot)
  const [laborClassificationVersion, setLaborClassificationVersion] = useState(0)
  useEffect(() => {
    let active=true
    const refresh=()=>active&&setData(snapshot())
    connectLiveData().then(refresh).catch(()=>{})
    const onFocus=()=>reconcileLiveData().then(refresh).catch(()=>{})
    const onVisibility=()=>{ if(document.visibilityState==='visible') reconcileLiveData().then(refresh).catch(()=>{}) }
    window.addEventListener('focus',onFocus)
    document.addEventListener('visibilitychange',onVisibility)
    const onLaborClassification=()=>setLaborClassificationVersion(value=>value+1)
    window.addEventListener('restapay:labor-classification-change',onLaborClassification)
    const unsub=subscribeLiveData(refresh)
    return ()=>{active=false;unsub();window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('restapay:labor-classification-change',onLaborClassification)}
  }, [])

  const scoped = useMemo(() => ({
    ...data,
    sales: data.sales.filter(row => inDateRange(row, range, ['view_date','sales_date','date'])),
    payroll: data.payroll.filter(row => inDateRange(row, range, ['pay_date','payroll_date','date'])),
    invoices: data.invoices.filter(row => inDateRange(row, range, ['invoice_date','date'])),
    expenses: data.expenses.filter(row => inDateRange(row, range, ['expense_date','date'])),
    cashLedger: data.cashLedger.filter(row => inDateRange(row, range, ['entry_date','date'])),
  }), [data, range])

  const metrics = useMemo(() => {
    const normalizedInvoices = scoped.invoices.map(normalizeInvoice)
    let laborMap = getLiveSetting('restapay-labor-classification', {}) || {}
    if (!laborMap || typeof laborMap !== 'object') laborMap = {}
    const employeeById = new Map((scoped.employees||[]).filter(e=>e?.id).map(e=>[String(e.id),e]))
    const employeeByName = new Map((scoped.employees||[]).map(e=>[String(e.name||e.employee_name||'').trim().toLowerCase(),e]))
    const classifiedPayroll = (scoped.payroll||[]).map(row=>{
      const employee = employeeById.get(String(row.employee_id||'')) || employeeByName.get(String(row.employee_name||row.employee||'').trim().toLowerCase())
      const job = String(row.job_type||row.job||row.position||row.role||employee?.job_type||employee?.job||employee?.position||employee?.role||'').trim()
      const mapped = laborMap[job.toLowerCase()] || laborMap[job] || ''
      return mapped ? {...row,labor_classification:mapped} : row
    })
    const payrollSummary = summarizePayroll(classifiedPayroll, scoped.employees)
    const financial = buildFinancialMetrics({
      sales: scoped.sales,
      payrollSummary,
      invoices: normalizedInvoices,
      expenses: scoped.expenses,
    })

    // Carry cash forward from every transaction before the selected range.
    const beforeRange = (row, keys=[]) => {
      const date = normalizeRowDate(row, keys)
      return Boolean(date && range?.from && date < range.from)
    }
    const priorSales = data.sales.filter(row=>beforeRange(row,['view_date','sales_date','date']))
    const priorPayroll = data.payroll.filter(row=>beforeRange(row,['pay_date','payroll_date','date']))
    const priorInvoices = data.invoices.filter(row=>beforeRange(row,['invoice_date','date'])).map(normalizeInvoice)
    const priorExpenses = data.expenses.filter(row=>beforeRange(row,['expense_date','date']))
    const priorPayrollSummary = summarizePayroll(priorPayroll, data.employees)
    const priorFinancial = buildFinancialMetrics({sales:priorSales,payrollSummary:priorPayrollSummary,invoices:priorInvoices,expenses:priorExpenses})
    const priorCashLedger = data.cashLedger.filter(row=>beforeRange(row,['entry_date','date']))
    const priorLedgerEffect = priorCashLedger.reduce((sum,row)=>sum + (String(row.entry_type||row.type).toLowerCase()==='withdrawal' ? -Math.abs(number(row.amount)) : number(row.amount)),0)
    const periodLedgerEffect = scoped.cashLedger.reduce((sum,row)=>sum + (String(row.entry_type||row.type).toLowerCase()==='withdrawal' ? -Math.abs(number(row.amount)) : number(row.amount)),0)
    const cashCarryForward = priorFinancial.cashRemaining + priorLedgerEffect
    const periodCashChange = financial.cashRemaining + periodLedgerEffect
    financial.cashCarryForward = cashCarryForward
    financial.periodCashChange = periodCashChange
    financial.cashLedgerRows = scoped.cashLedger
    financial.cashWithdrawalRows = scoped.cashLedger.filter(row=>String(row.entry_type||row.type).toLowerCase()==='withdrawal')
    financial.cashAdjustmentRows = scoped.cashLedger.filter(row=>String(row.entry_type||row.type).toLowerCase()==='adjustment')
    financial.cashWithdrawals = financial.cashWithdrawalRows.reduce((sum,row)=>sum+Math.abs(number(row.amount)),0)
    financial.cashAdjustments = financial.cashAdjustmentRows.reduce((sum,row)=>sum+number(row.amount),0)
    financial.cashRemaining = cashCarryForward + periodCashChange

    const vendorSpend = new Map()
    normalizedInvoices.forEach(row => {
      const vendor = row.vendor || 'Unassigned'
      vendorSpend.set(vendor, (vendorSpend.get(vendor) || 0) + number(row.amount ?? row.total))
    })
    const topVendors = [...vendorSpend.entries()].sort((a,b) => b[1]-a[1]).slice(0,3)
    const priceHistory = buildPriceHistory(normalizedInvoices)
    const priceComparisons = comparePrices(priceHistory)
    let costSettings = { departmentAllocations: DEFAULT_ALLOCATION_RULES }
    const savedCostSettings = getLiveSetting('restapay-cost-settings', {}) || {}
    if (savedCostSettings && typeof savedCostSettings === 'object') costSettings = {...costSettings,...savedCostSettings}
    const invoiceSpend = scoped.invoices.flatMap(invoice => {
      const lines = Array.isArray(invoice.lines) ? invoice.lines : []
      if (lines.length) return lines.map(line => ({...line,vendor:invoice.vendor||invoice.vendor_name,vendor_name:invoice.vendor||invoice.vendor_name,invoice_number:invoice.invoice_number||invoice.number,invoice_date:invoice.invoice_date||invoice.date,category:line.category||invoice.category,_source_table:'invoice_items'}))
      return [{...invoice,amount:invoice.amount??invoice.total,_source_table:'invoices'}]
    })
    const expenseSpend = scoped.expenses.filter(row=>!/cash withdrawal|owner withdrawal|cash draw/i.test(`${row.category||''} ${row.type||''} ${row.name||''} ${row.payment_type||''}`)).map(row=>({...row,_source_table:'expenses'}))
    const departmentCosts = calculateDepartmentCosts({salesRows:scoped.sales,payrollRows:classifiedPayroll,employees:scoped.employees,spendRows:[...invoiceSpend,...expenseSpend],settings:costSettings})

    return { ...financial, payrollSummary, departmentCosts, trueFoodCost:departmentCosts.trueFoodCost, trueAlcoholCost:departmentCosts.trueAlcoholCost, trueFoodCostPercent:departmentCosts.foodCostPercent, trueAlcoholCostPercent:departmentCosts.alcoholCostPercent, topVendors, priceHistory, priceComparisons, normalizedInvoices }
  }, [scoped, data, range, laborClassificationVersion])

  return { ...scoped, metrics, dateRange: range }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
