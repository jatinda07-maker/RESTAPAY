import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'

import { liveSnapshot, subscribeLiveData, initializeLiveData } from '../data/liveDataStore.js'
import useGlobalDateRange, { inDateRange } from './useGlobalDateRange.js'

const number = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const categoryName = (row) => String(row.category || row.department || row.type || '').toLowerCase()
const isAlcohol = (row) => /alcohol|beer|wine|liquor|margarita|cocktail|shot/.test(categoryName(row))
const isFood = (row) => /food|meat|seafood|produce|dairy|dry goods|frozen/.test(categoryName(row)) && !isAlcohol(row)

function snapshot(){ const value=liveSnapshot()||{};return {sales:Array.isArray(value.sales)?value.sales.filter(Boolean):[],payroll:Array.isArray(value.payroll)?value.payroll.filter(Boolean):[],invoices:Array.isArray(value.invoices)?value.invoices.filter(Boolean):[],expenses:Array.isArray(value.expenses)?value.expenses.filter(Boolean):[],vendors:Array.isArray(value.vendors)?value.vendors.filter(Boolean):[],employees:Array.isArray(value.employees)?value.employees.filter(Boolean):[]} }

export function useAppData() {
  const { range } = useGlobalDateRange()
  const [data, setData] = useState(snapshot)
  useEffect(() => {
    let active=true
    const refresh=()=>active&&setData(snapshot())
    initializeLiveData().then(refresh).catch(()=>{})
    const unsub=subscribeLiveData(refresh)
    return ()=>{active=false;unsub()}
  }, [])

  const scoped = useMemo(() => ({
    ...data,
    sales: data.sales.filter(row => inDateRange(row, range, ['view_date','sales_date','date'])),
    payroll: data.payroll.filter(row => inDateRange(row, range, ['pay_date','payroll_date','date'])),
    invoices: data.invoices.filter(row => inDateRange(row, range, ['invoice_date','date'])),
    expenses: data.expenses.filter(row => inDateRange(row, range, ['expense_date','date'])),
  }), [data, range])

  const metrics = useMemo(() => {
    const salesTotal = scoped.sales.reduce((sum, row) => sum + number(row.net_sales ?? row.amount ?? row.sales), 0)
    const foodSales = scoped.sales.reduce((sum, row) => sum + number(row.food_sales ?? (isFood(row) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const alcoholSales = scoped.sales.reduce((sum, row) => sum + number(row.alcohol_sales ?? (isAlcohol(row) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const explicitOtherSales = scoped.sales.reduce((sum, row) => sum + number(row.other_sales), 0)
    const otherSales = explicitOtherSales || Math.max(0, salesTotal - foodSales - alcoholSales)
    const tips = scoped.sales.reduce((sum, row) => sum + number(row.tips_collected ?? row.tips), 0)
    const cashSales = scoped.sales.reduce((sum, row) => sum + number(row.cash_sales ?? (String(row.payment || row.payment_type || '').toLowerCase() === 'cash' ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const creditSales = scoped.sales.reduce((sum, row) => sum + number(row.credit_sales ?? (/credit|card/.test(String(row.payment || row.payment_type || '').toLowerCase()) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)

    const normalizedInvoices = scoped.invoices.map(normalizeInvoice)
    const lineTotals = normalizedInvoices.flatMap(invoice => (invoice.lines || []).map(line => ({...line, invoice, category: line.category || invoice.category})))
    const foodInvoices = normalizedInvoices.filter(isFood)
    const alcoholInvoices = normalizedInvoices.filter(isAlcohol)
    const foodLineCost = lineTotals.filter(isFood).reduce((sum,row)=>sum+number(row.line_total),0)
    const alcoholLineCost = lineTotals.filter(isAlcohol).reduce((sum,row)=>sum+number(row.line_total),0)
    const foodCost = lineTotals.length ? foodLineCost : foodInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const alcoholCost = lineTotals.length ? alcoholLineCost : alcoholInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const invoiceTotal = normalizedInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const expenseTotal = scoped.expenses.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const cashExpenses = scoped.expenses.filter(row => String(row.method || row.payment_type || '').toLowerCase() === 'cash')
      .reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const payroll = summarizePayroll(scoped.payroll)
    const cashRemaining = cashSales - payroll.cash - cashExpenses
    const cogs = foodCost + alcoholCost
    const primeCostAmount = cogs + payroll.total
    const operatingProfit = salesTotal - cogs - payroll.total - expenseTotal
    const percent = (value, base) => base > 0 ? (value / base) * 100 : 0

    const vendorSpend = new Map()
    normalizedInvoices.forEach(row => {
      const vendor = row.vendor || 'Unassigned'
      vendorSpend.set(vendor, (vendorSpend.get(vendor) || 0) + number(row.amount ?? row.total))
    })
    const topVendors = [...vendorSpend.entries()].sort((a,b) => b[1]-a[1]).slice(0,3)

    const priceHistory = buildPriceHistory(normalizedInvoices)
    const priceComparisons = comparePrices(priceHistory)

    return {
      salesTotal, foodSales, alcoholSales, otherSales, tips, cashSales, creditSales,
      foodCost, alcoholCost, invoiceTotal, expenseTotal, cashExpenses,
      payrollTotal: payroll.total, cashPayroll: payroll.cash, checkPayroll: payroll.check, payrollHours: payroll.hours,
      cashRemaining, cogs, primeCostAmount, operatingProfit,
      foodCostPercent: percent(foodCost, foodSales), alcoholCostPercent: percent(alcoholCost, alcoholSales),
      primeCostPercent: percent(primeCostAmount, salesTotal), laborMixPercent: percent(payroll.total, salesTotal),
      operatingMargin: percent(operatingProfit, salesTotal), topVendors,
      foodInvoiceCount: foodInvoices.length, alcoholInvoiceCount: alcoholInvoices.length, priceHistory, priceComparisons, normalizedInvoices,
    }
  }, [scoped])

  return { ...scoped, metrics, dateRange: range }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
