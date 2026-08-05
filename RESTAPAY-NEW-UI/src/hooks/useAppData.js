import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'

const KEYS = {
  sales: 'restapay.sales',
  payroll: 'restapay-payroll',
  invoices: 'restapay-invoices',
  expenses: 'restapay-expenses',
  vendors: 'restapay-vendors',
  employees: 'restapay-employees',
}

const readArray = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const number = (value) => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const categoryName = (row) => String(row.category || row.department || row.type || '').toLowerCase()
const isAlcohol = (row) => /alcohol|beer|wine|liquor|margarita|cocktail|shot/.test(categoryName(row))
const isFood = (row) => /food|meat|seafood|produce|dairy|dry goods|frozen/.test(categoryName(row)) && !isAlcohol(row)

function snapshot() {
  return Object.fromEntries(Object.entries(KEYS).map(([name, key]) => [name, readArray(key)]))
}

export function useAppData() {
  const [data, setData] = useState(snapshot)
  useEffect(() => {
    const refresh = () => setData(snapshot())
    window.addEventListener('restapay:data-change', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('restapay:data-change', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const metrics = useMemo(() => {
    const salesTotal = data.sales.reduce((sum, row) => sum + number(row.net_sales ?? row.amount ?? row.sales), 0)
    const foodSales = data.sales.reduce((sum, row) => sum + number(row.food_sales ?? (isFood(row) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const alcoholSales = data.sales.reduce((sum, row) => sum + number(row.alcohol_sales ?? (isAlcohol(row) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const explicitOtherSales = data.sales.reduce((sum, row) => sum + number(row.other_sales), 0)
    const otherSales = explicitOtherSales || Math.max(0, salesTotal - foodSales - alcoholSales)
    const tips = data.sales.reduce((sum, row) => sum + number(row.tips_collected ?? row.tips), 0)
    const cashSales = data.sales.reduce((sum, row) => sum + number(row.cash_sales ?? (String(row.payment || row.payment_type || '').toLowerCase() === 'cash' ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)
    const creditSales = data.sales.reduce((sum, row) => sum + number(row.credit_sales ?? (/credit|card/.test(String(row.payment || row.payment_type || '').toLowerCase()) ? (row.amount ?? row.net_sales ?? row.sales) : 0)), 0)

    const normalizedInvoices = data.invoices.map(normalizeInvoice)
    const lineTotals = normalizedInvoices.flatMap(invoice => (invoice.lines || []).map(line => ({...line, invoice, category: line.category || invoice.category})))
    const foodInvoices = normalizedInvoices.filter(isFood)
    const alcoholInvoices = normalizedInvoices.filter(isAlcohol)
    const foodLineCost = lineTotals.filter(isFood).reduce((sum,row)=>sum+number(row.line_total),0)
    const alcoholLineCost = lineTotals.filter(isAlcohol).reduce((sum,row)=>sum+number(row.line_total),0)
    const foodCost = lineTotals.length ? foodLineCost : foodInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const alcoholCost = lineTotals.length ? alcoholLineCost : alcoholInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const invoiceTotal = normalizedInvoices.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const expenseTotal = data.expenses.reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const cashExpenses = data.expenses.filter(row => String(row.method || row.payment_type || '').toLowerCase() === 'cash')
      .reduce((sum, row) => sum + number(row.amount ?? row.total), 0)
    const payroll = summarizePayroll(data.payroll)
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
  }, [data])

  return { ...data, metrics }
}

export const appMoney = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits:0 }).format(number(value))
export const appMoney2 = (value) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2 }).format(number(value))
export const appPercent = (value) => `${number(value).toFixed(1)}%`
