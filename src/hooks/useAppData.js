import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'
import { buildFinancialMetrics } from '../core/engines/FinancialReconciliation.js'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

import { liveSnapshot, subscribeLiveData, initializeLiveData, reloadLiveCollection } from '../data/liveDataStore.js'
import useGlobalDateRange, { inDateRange, normalizeRowDate } from './useGlobalDateRange.js'

const number = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0

function snapshot(){ const value=liveSnapshot()||{};return {sales:Array.isArray(value.sales)?value.sales.filter(Boolean):[],payroll:Array.isArray(value.payroll)?value.payroll.filter(Boolean):[],invoices:Array.isArray(value.invoices)?value.invoices.filter(Boolean):[],expenses:Array.isArray(value.expenses)?value.expenses.filter(Boolean):[],vendors:Array.isArray(value.vendors)?value.vendors.filter(Boolean):[],employees:Array.isArray(value.employees)?value.employees.filter(Boolean):[]} }

export function useAppData(overrideRange = null) {
  const { range: globalRange } = useGlobalDateRange()
  const range = overrideRange?.from && overrideRange?.to ? overrideRange : globalRange
  const [data, setData] = useState(snapshot)
  useEffect(() => {
    let active=true
    const refresh=()=>active&&setData(snapshot())
    const liveKeys=['restapay.sales','restapay-payroll','restapay-invoices','restapay-expenses','restapay-vendors','restapay-employees']
    const refreshFromCloud=async()=>{
      await initializeLiveData().catch(()=>{})
      await Promise.allSettled(liveKeys.map(key=>reloadLiveCollection(key)))
      refresh()
    }
    refreshFromCloud()
    const onFocus=()=>refreshFromCloud()
    const onVisibility=()=>{ if(document.visibilityState==='visible') refreshFromCloud() }
    window.addEventListener('focus',onFocus)
    document.addEventListener('visibilitychange',onVisibility)
    const unsub=subscribeLiveData(refresh)
    return ()=>{active=false;unsub();window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisibility)}
  }, [])

  const scoped = useMemo(() => ({
    ...data,
    sales: data.sales.filter(row => inDateRange(row, range, ['view_date','sales_date','date'])),
    payroll: data.payroll.filter(row => inDateRange(row, range, ['pay_date','payroll_date','date'])),
    invoices: data.invoices.filter(row => inDateRange(row, range, ['invoice_date','date'])),
    expenses: data.expenses.filter(row => inDateRange(row, range, ['expense_date','date'])),
  }), [data, range])

  const metrics = useMemo(() => {
    const normalizedInvoices = scoped.invoices.map(normalizeInvoice)
    const payrollSummary = summarizePayroll(scoped.payroll, scoped.employees)
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
    const cashCarryForward = priorFinancial.cashRemaining
    const periodCashChange = financial.cashRemaining
    financial.cashCarryForward = cashCarryForward
    financial.periodCashChange = periodCashChange
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
    try { const saved = JSON.parse(localStorage.getItem('restapay-cost-settings') || '{}'); costSettings = {...costSettings,...saved} } catch {}
    const invoiceSpend = scoped.invoices.flatMap(invoice => {
      const lines = Array.isArray(invoice.lines) ? invoice.lines : []
      if (lines.length) return lines.map(line => ({...line,vendor:invoice.vendor||invoice.vendor_name,vendor_name:invoice.vendor||invoice.vendor_name,invoice_number:invoice.invoice_number||invoice.number,invoice_date:invoice.invoice_date||invoice.date,category:line.category||invoice.category,_source_table:'invoice_items'}))
      return [{...invoice,amount:invoice.amount??invoice.total,_source_table:'invoices'}]
    })
    const expenseSpend = scoped.expenses.filter(row=>!/cash withdrawal|owner withdrawal|cash draw/i.test(`${row.category||''} ${row.type||''} ${row.name||''} ${row.payment_type||''}`)).map(row=>({...row,_source_table:'expenses'}))
    const departmentCosts = calculateDepartmentCosts({salesRows:scoped.sales,payrollRows:scoped.payroll,employees:scoped.employees,spendRows:[...invoiceSpend,...expenseSpend],settings:costSettings})

    return { ...financial, payrollSummary, departmentCosts, trueFoodCost:departmentCosts.trueFoodCost, trueAlcoholCost:departmentCosts.trueAlcoholCost, trueFoodCostPercent:departmentCosts.foodCostPercent, trueAlcoholCostPercent:departmentCosts.alcoholCostPercent, topVendors, priceHistory, priceComparisons, normalizedInvoices }
  }, [scoped, data, range])

  return { ...scoped, metrics, dateRange: range }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
