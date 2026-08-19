import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'
import { buildFinancialMetrics } from '../core/engines/FinancialReconciliation.js'

import { liveSnapshot, subscribeLiveData, initializeLiveData, reloadLiveCollection } from '../data/liveDataStore.js'
import useGlobalDateRange, { inDateRange } from './useGlobalDateRange.js'

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
    const payrollSummary = summarizePayroll(scoped.payroll)
    const financial = buildFinancialMetrics({
      sales: scoped.sales,
      payrollSummary,
      invoices: normalizedInvoices,
      expenses: scoped.expenses,
    })

    const vendorSpend = new Map()
    normalizedInvoices.forEach(row => {
      const vendor = row.vendor || 'Unassigned'
      vendorSpend.set(vendor, (vendorSpend.get(vendor) || 0) + number(row.amount ?? row.total))
    })
    const topVendors = [...vendorSpend.entries()].sort((a,b) => b[1]-a[1]).slice(0,3)
    const priceHistory = buildPriceHistory(normalizedInvoices)
    const priceComparisons = comparePrices(priceHistory)

    return { ...financial, topVendors, priceHistory, priceComparisons, normalizedInvoices }
  }, [scoped])

  return { ...scoped, metrics, dateRange: range }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
