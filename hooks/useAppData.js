import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'
import { buildFinancialMetrics } from '../core/engines/FinancialReconciliation.js'

import { liveSnapshot, subscribeLiveData, initializeLiveData, reloadLiveCollection } from '../data/liveDataStore.js'
import useGlobalDateRange, { inDateRange } from './useGlobalDateRange.js'

const number = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0

function snapshot(){ const value=liveSnapshot()||{};return {sales:Array.isArray(value.sales)?value.sales.filter(Boolean):[],payroll:Array.isArray(value.payroll)?value.payroll.filter(Boolean):[],invoices:Array.isArray(value.invoices)?value.invoices.filter(Boolean):[],expenses:Array.isArray(value.expenses)?value.expenses.filter(Boolean):[],vendors:Array.isArray(value.vendors)?value.vendors.filter(Boolean):[],employees:Array.isArray(value.employees)?value.employees.filter(Boolean):[],cashLedger:Array.isArray(value.cashLedger)?value.cashLedger.filter(Boolean):[]} }

export function useAppData(overrideRange = null) {
  const { range: globalRange } = useGlobalDateRange()
  const range = overrideRange?.from && overrideRange?.to ? overrideRange : globalRange
  const [data, setData] = useState(snapshot)
  useEffect(() => {
    let active=true
    const refresh=()=>active&&setData(snapshot())
    const liveKeys=['restapay.sales','restapay-payroll','restapay-invoices','restapay-expenses','restapay-vendors','restapay-employees','restapay-cash-ledger']
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
    cashLedger: data.cashLedger.filter(row => inDateRange(row, range, ['entry_date','date'])),
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

    const ledgerRows=data.cashLedger||[]
    const before=(range?.from?ledgerRows.filter(r=>String(r.entry_date||r.date||'')<range.from):[]).filter(r=>String(r.entry_type||r.type||'').toLowerCase()==='closing_balance').sort((a,b)=>String(b.entry_date||b.date).localeCompare(String(a.entry_date||a.date)))
    const openingCash=before.length?number(before[0].amount):0
    const periodLedger=scoped.cashLedger||[]
    const cashWithdrawals=periodLedger.filter(r=>String(r.entry_type||r.type||'').toLowerCase()==='withdrawal').reduce((a,r)=>a+number(r.amount),0)
    const closing=periodLedger.filter(r=>String(r.entry_type||r.type||'').toLowerCase()==='closing_balance').sort((a,b)=>String(b.entry_date||b.date).localeCompare(String(a.entry_date||a.date)))[0]
    financial.openingCash=openingCash; financial.cashWithdrawals=cashWithdrawals; financial.calculatedCashRemaining=openingCash+financial.cashRemaining-cashWithdrawals; financial.cashRemaining=closing?number(closing.amount):financial.calculatedCashRemaining; financial.reconciledClosingCash=closing?number(closing.amount):null
    const vendorSpend = new Map()
    normalizedInvoices.forEach(row => {
      const vendor = row.vendor || 'Unassigned'
      vendorSpend.set(vendor, (vendorSpend.get(vendor) || 0) + number(row.amount ?? row.total))
    })
    const topVendors = [...vendorSpend.entries()].sort((a,b) => b[1]-a[1]).slice(0,3)
    const priceHistory = buildPriceHistory(normalizedInvoices)
    const priceComparisons = comparePrices(priceHistory)

    return { ...financial, topVendors, priceHistory, priceComparisons, normalizedInvoices }
  }, [scoped, data.cashLedger, range])

  return { ...scoped, metrics, dateRange: range }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
