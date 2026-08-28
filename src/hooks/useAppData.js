import { useEffect, useMemo, useState } from 'react'
import { summarizePayroll, summarizePrimeCostDailyLabor } from '../core/adapters/payrollAdapter.js'
import { buildPriceHistory, comparePrices, normalizeInvoice } from '../core/engines/InvoiceEngine.js'
import { buildFinancialMetrics } from '../core/engines/FinancialReconciliation.js'
import { calculateDepartmentCosts, DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

import { liveSnapshot, subscribeLiveData, connectLiveData, reconcileLiveData, getLiveSetting, cashClosingBalanceTarget } from '../data/liveDataStore.js'
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
    const primeCostLabor = summarizePrimeCostDailyLabor(data.payroll, data.employees, range)
    const financial = buildFinancialMetrics({
      sales: scoped.sales,
      payrollSummary,
      primeCostLabor,
      invoices: normalizedInvoices,
      expenses: scoped.expenses,
    })

    // Cash balance is cumulative, but a physical closing-cash reconciliation is an
    // authoritative anchor. Use the latest reconciliation on or before the selected
    // range end, even when that reconciliation falls inside the selected range.
    // This prevents refresh/date-range changes from replacing the live balance with
    // the prior closing count itself (for example, $203 instead of $559).
    const rowDate = (row,keys=[]) => normalizeRowDate(row,keys)
    const beforeRange = (row, keys=[]) => {
      const date = rowDate(row, keys)
      return Boolean(date && range?.from && date < range.from)
    }
    const throughRangeEnd = (row, keys=[]) => {
      const date = rowDate(row, keys)
      return Boolean(date && (!range?.to || date <= range.to))
    }
    const priorSales = data.sales.filter(row=>beforeRange(row,['view_date','sales_date','date']))
    const priorPayroll = data.payroll.filter(row=>beforeRange(row,['pay_date','payroll_date','date']))
    const priorInvoices = data.invoices.filter(row=>beforeRange(row,['invoice_date','date'])).map(normalizeInvoice)
    const priorExpenses = data.expenses.filter(row=>beforeRange(row,['expense_date','date']))
    const priorPayrollSummary = summarizePayroll(priorPayroll, data.employees)
    const priorFinancial = buildFinancialMetrics({sales:priorSales,payrollSummary:priorPayrollSummary,invoices:priorInvoices,expenses:priorExpenses})
    const priorCashLedger = data.cashLedger.filter(row=>beforeRange(row,['entry_date','date']))
    const ledgerEffect = rows => rows.reduce((sum,row)=>sum + (String(row.entry_type||row.type).toLowerCase()==='withdrawal' ? -Math.abs(number(row.amount)) : number(row.amount)),0)
    const priorLedgerEffect = ledgerEffect(priorCashLedger)
    const periodLedgerEffect = ledgerEffect(scoped.cashLedger)

    const isClosingBalance = row => String(row.entry_type||row.type).toLowerCase()==='adjustment' && /set closing balance|closing cash|cash balance reconciliation/i.test(`${row.purpose||''} ${row.notes||''}`)
    const reconciliationRows = data.cashLedger
      .filter(row=>isClosingBalance(row) && throughRangeEnd(row,['entry_date','date']))
      .sort((a,b)=>String(a.entry_date||a.date).localeCompare(String(b.entry_date||b.date)))
    const latestReconciliation = reconciliationRows.at(-1)

    const cashPositionThrough = date => {
      const through = (row,keys=[]) => { const d=rowDate(row,keys); return Boolean(d && d <= date) }
      const salesRows=data.sales.filter(row=>through(row,['view_date','sales_date','date']))
      const payrollRows=data.payroll.filter(row=>through(row,['pay_date','payroll_date','date']))
      const invoiceRows=data.invoices.filter(row=>through(row,['invoice_date','date'])).map(normalizeInvoice)
      const expenseRows=data.expenses.filter(row=>through(row,['expense_date','date']))
      const payrollSummary=summarizePayroll(payrollRows,data.employees)
      const base=buildFinancialMetrics({sales:salesRows,payrollSummary,invoices:invoiceRows,expenses:expenseRows})
      const ledgerRows=data.cashLedger.filter(row=>through(row,['entry_date','date']))
      return base.cashRemaining + ledgerEffect(ledgerRows)
    }

    const financialBetween = (afterDate, beforeDateExclusive=null, throughDate=range?.to) => {
      const inside = (row,keys=[]) => {
        const date=rowDate(row,keys)
        if (!date || date <= afterDate) return false
        if (beforeDateExclusive && date >= beforeDateExclusive) return false
        if (throughDate && date > throughDate) return false
        return true
      }
      const salesRows=data.sales.filter(row=>inside(row,['view_date','sales_date','date']))
      const payrollRows=data.payroll.filter(row=>inside(row,['pay_date','payroll_date','date']))
      const invoiceRows=data.invoices.filter(row=>inside(row,['invoice_date','date'])).map(normalizeInvoice)
      const expenseRows=data.expenses.filter(row=>inside(row,['expense_date','date']))
      const payrollSummary=summarizePayroll(payrollRows,data.employees)
      const base=buildFinancialMetrics({sales:salesRows,payrollSummary,invoices:invoiceRows,expenses:expenseRows})
      const ledgerRows=data.cashLedger.filter(row=>inside(row,['entry_date','date']) && !isClosingBalance(row))
      return { base, ledger: ledgerEffect(ledgerRows) }
    }

    let cashCarryForward = priorFinancial.cashRemaining + priorLedgerEffect
    let cashRemaining = cashCarryForward + financial.cashRemaining + periodLedgerEffect
    if (latestReconciliation) {
      const reconciliationDate = rowDate(latestReconciliation,['entry_date','date'])
      const explicitTarget = cashClosingBalanceTarget(latestReconciliation)
      const reconciledClosing = explicitTarget === null ? cashPositionThrough(reconciliationDate) : explicitTarget

      // Opening cash for the selected range comes from the same reconciliation anchor.
      if (range?.from && reconciliationDate < range.from) {
        const opening = financialBetween(reconciliationDate, range.from, range.from)
        cashCarryForward = reconciledClosing + opening.base.cashRemaining + opening.ledger
      }

      // Ending/current cash always starts at the latest physical count and then applies
      // every transaction after that count through the selected end date.
      const afterReconciliation = financialBetween(reconciliationDate, null, range?.to)
      cashRemaining = reconciledClosing + afterReconciliation.base.cashRemaining + afterReconciliation.ledger
    }

    const periodCashChange = cashRemaining - cashCarryForward
    financial.cashCarryForward = cashCarryForward
    financial.periodCashChange = periodCashChange
    financial.cashLedgerRows = scoped.cashLedger
    financial.cashWithdrawalRows = scoped.cashLedger.filter(row=>String(row.entry_type||row.type).toLowerCase()==='withdrawal')
    financial.cashAdjustmentRows = scoped.cashLedger.filter(row=>String(row.entry_type||row.type).toLowerCase()==='adjustment')
    financial.cashWithdrawals = financial.cashWithdrawalRows.reduce((sum,row)=>sum+Math.abs(number(row.amount)),0)
    financial.cashAdjustments = financial.cashAdjustmentRows.filter(row=>!isClosingBalance(row)).reduce((sum,row)=>sum+number(row.amount),0)
    financial.cashRemaining = cashRemaining

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
