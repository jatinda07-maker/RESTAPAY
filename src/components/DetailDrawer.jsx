import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Download, Expand, Minimize2, Printer, Save, X } from 'lucide-react'
import { useFeedback } from './AppFeedback'
import { useNavigate } from 'react-router-dom'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import useGlobalDateRange, { presetDates, readDateRange } from '../hooks/useGlobalDateRange'
import { payrollCostClass } from '../core/adapters/payrollAdapter.js'


const rowsTotal = (rows, field = 'amount') => rows.reduce((sum,row) => sum + (Number(row[field] ?? row.total ?? 0) || 0), 0)
const salesCategory = (rows, pattern) => rows.filter(row => pattern.test(String(row.category || row.department || ''))).reduce((sum,row)=>sum+(Number(row.amount||0)||0),0)
const formatRangeDate = value => { if (!value) return '—'; const [y,m,d] = String(value).split('-').map(Number); const date = y&&m&&d ? new Date(y,m-1,d) : new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}) }

function buildDrawerContent(title, { metrics, sales, invoices, expenses, payroll, vendors, employees }) {
  const tone = /cost|expense|alcohol/i.test(title || '') ? 'orange' : /profit|cash|food/i.test(title || '') ? 'green' : /vendor|payroll|labor|employee/i.test(title || '') ? 'purple' : 'blue'
  const dc = metrics.departmentCosts || {}
  const operatingRows = metrics.payrollSummary?.operatingRows || payroll.filter(row=>payrollCostClass(row)==='operating-labor')
  const managementRows = metrics.payrollSummary?.managementRows || payroll.filter(row=>payrollCostClass(row)==='management')
  const fohRows = metrics.payrollSummary?.frontOfHouseRows || payroll.filter(row=>payrollCostClass(row)==='front-of-house')
  const reviewRows = metrics.payrollSummary?.reviewRows || payroll.filter(row=>payrollCostClass(row)==='review')
  const salesRows = [['Food Sales','Food department',appMoney(dc.foodSales ?? metrics.foodSales)],['Alcohol Sales','Beer, wine and liquor',appMoney(dc.alcoholSales ?? metrics.alcoholSales)],['Other Sales','Other categories',appMoney(metrics.otherSales)]]
  const paymentRows = [['Cash Sales','Cash payments',appMoney(metrics.cashSales)],['Credit Sales','Card payments',appMoney(metrics.creditSales)],['Tips','Excluded from profit',appMoney(metrics.tips)]]
  const expenseGroups = Object.values(expenses.reduce((acc,row)=>{const label=String(row.expense_type||row.type||row.category||'Other').trim()||'Other';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0,total:0};acc[key].count+=1;acc[key].total+=Number(row.amount??row.total??0)||0;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} record${g.count===1?'':'s'}`,appMoney(g.total)])
  const jobGroups = Object.values(payroll.reduce((acc,row)=>{const label=String(row.job_type||row.job||row.position||row.role||'Unassigned / Review').trim()||'Unassigned / Review';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0,total:0};acc[key].count+=1;acc[key].total+=payrollEntryValue(row);return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} payroll record${g.count===1?'':'s'}`,appMoney(g.total)])
  const trueFoodRows = [['Direct Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(dc.directFoodCost ?? metrics.foodCost)],['Kitchen Payroll',`${dc.payrollDetails?.kitchen?.length||operatingRows.length} operating labor entries`,appMoney(dc.kitchenPayroll ?? metrics.operatingLabor)],['Manager Allocation',`${dc.payrollDetails?.manager?.length||managementRows.length} management entries`,appMoney(dc.managerFood||0)],['Supplies Allocation',`${dc.rules?.supplies?.food??0}% Food`,appMoney(dc.foodSupplies||0)],['Shared Costs','Cleaning · Cintas · Utilities · Insurance · Other',appMoney(dc.foodShared||0)],['Food Sales','Matching department sales',appMoney(dc.foodSales ?? metrics.foodSales)]]
  const trueAlcoholRows = [['Direct Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(dc.directAlcoholCost ?? metrics.alcoholCost)],['Bar Payroll',`${dc.payrollDetails?.bar?.length||0} bar payroll entries`,appMoney(dc.barPayroll||0)],['Manager Allocation',`${dc.payrollDetails?.manager?.length||managementRows.length} management entries`,appMoney(dc.managerAlcohol||0)],['Supplies / Shared Allocation','Allocated shared operating costs',appMoney(dc.alcoholShared||0)],['Alcohol Sales','Matching department sales',appMoney(dc.alcoholSales ?? metrics.alcoholSales)]]
  const costRows = [['Direct Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['Direct Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} allocated records`,appMoney(metrics.managementPayroll||0)],['Front of House Wages',`${fohRows.length} records · tips excluded`,appMoney(metrics.frontOfHousePayroll||0)],['Unmapped Payroll',`${reviewRows.length} records · review classification`,appMoney(metrics.reviewPayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned net tips',appMoney(metrics.netTipsPaid)]]
  const map = {
    'Net Sales': ['Sales by category and payment type', [{title:'Sales by Category',rows:salesRows,total:['Net Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Payments',appMoney(metrics.salesTotal)]}]],
    'Cash Flow': ['Cash collected less cash payroll, cash invoices and cash expenses', [{title:'Cash Flow',rows:[['Cash Collected',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} sales days`,appMoney(metrics.cashSales)],['Cash Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').length} payroll entries`,appMoney(-metrics.cashPayroll)],['Cash Vendor Invoices',`${invoices.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} invoices`,appMoney(-metrics.cashInvoiceSpend)],['Cash Expenses',`${expenses.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} expense entries`,appMoney(-metrics.cashExpenses)]],total:['Cash Remaining',appMoney(metrics.cashRemaining)]}]],
    'Cash Collected': ['Cash sales for the selected period', [{title:'Cash Collected',rows:[['Cash Sales',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} daily records`,appMoney(metrics.cashSales)]],total:['Cash Collected',appMoney(metrics.cashSales)]}]],
    'Cash Remaining': ['Cash collected less cash payroll, cash invoices and expenses', [{title:'Cash Remaining',rows:[['Cash Collected','Sales cash receipts',appMoney(metrics.cashSales)],['Cash Payroll','Cash payroll payments',appMoney(-metrics.cashPayroll)],['Cash Vendor Invoices','Cash-paid vendor invoices',appMoney(-metrics.cashInvoiceSpend)],['Cash Expenses','Cash operating expenses',appMoney(-metrics.cashExpenses)]],total:['Cash Remaining',appMoney(metrics.cashRemaining)]}]],
    'Prime Cost': ['Direct food/alcohol purchases plus BOH operating labor; tips excluded', [{title:'Prime Cost',rows:costRows,total:['Prime Cost',appMoney(metrics.primeCostAmount)]}]],
    'Labor Mix': ['Employer-funded labor compared with sales; employee tips excluded', [{title:'Labor Mix',rows:[['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} records · allocated separately`,appMoney(metrics.managementPayroll||0)],['Front of House Payroll',`${fohRows.length} records · excluded from Operating Labor`,appMoney(metrics.frontOfHousePayroll||0)],['Unmapped Payroll',`${reviewRows.length} records · review classification`,appMoney(metrics.reviewPayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned net tips',appMoney(metrics.netTipsPaid)],['Net Sales',`${sales.length} sales days`,appMoney(metrics.salesTotal)]],total:['Employer Labor Cost',appMoney(metrics.employerLabor||metrics.operatingLabor)]}]],
    'Operating Profit': ['Sales less food, alcohol, operating labor and expenses', [{title:'Operating Profit',rows:[['Net Sales',`${sales.length} sales days`,appMoney(metrics.salesTotal)],['Cost of Goods','Food and alcohol',appMoney(-metrics.cogs)],['Employer Labor Cost','BOH + management + FOH wages · employee tips excluded',appMoney(-(metrics.employerLabor||metrics.operatingLabor))],['Tip Pass-Through','Employee-owned net tips · not deducted',appMoney(metrics.netTipsPaid)],['Expenses',`${expenses.length} records`,appMoney(-metrics.expenseTotal)]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Business Expenses': ['Operating expenses in the selected period', [{title:'Expense Categories',rows:[['All Expenses',`${expenses.length} records`,appMoney(metrics.expenseTotal)],...expenseGroups],total:['Business Expenses',appMoney(metrics.expenseTotal)]},{title:'Payment Methods',rows:[['Cash Expenses','Cash payments',appMoney(metrics.cashExpenses)],['Check & ACH','Check / ACH payments',appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((s,r)=>s+(Number(r.amount||r.total||0)||0),0))],['Credit Expenses','Credit/card payments',appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((s,r)=>s+(Number(r.amount||r.total||0)||0),0))]],total:['All Payment Methods',appMoney(metrics.expenseTotal)]}]],
    'Cash Sales': ['Actual cash sales and payments', [{title:'Cash Activity',rows:[['Cash Sales',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} daily records`,appMoney(metrics.cashSales)]],total:['Cash Sales',appMoney(metrics.cashSales)]}]],
    'Credit Sales': ['Card and debit activity', [{title:'Credit Activity',rows:[['Credit Sales',`${sales.filter(r=>Number(r.credit_sales||0)!==0).length} daily records`,appMoney(metrics.creditSales)]],total:['Credit Sales',appMoney(metrics.creditSales)]}]],
    'Other Sales': ['Other payment activity', [{title:'Other Activity',rows:[['Other Sales','Delivery and other',appMoney(metrics.otherSales)]],total:['Other Sales',appMoney(metrics.otherSales)]}]],
    'Tips Earned': ['Customer tips kept separate from profit', [{title:'Tip Activity',rows:[['Tips',`${sales.length} sales records`,appMoney(metrics.tips)]],total:['Tips Earned',appMoney(metrics.tips)]}]],
    'Sales Summary': ['Detailed breakdown of sales', [{title:'Sales Breakdown',rows:salesRows,total:['Total Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Total Payments',appMoney(metrics.salesTotal)]}]],
    'Cost Breakdown': ['Food, alcohol, labor and prime cost', [{title:'Current Period Costs',rows:costRows,total:['Prime Cost',appMoney(metrics.primeCostAmount)]}]],
    'Profit Summary': ['Income, deductions and operating profit', [{title:'Profit Detail',rows:[['Gross Sales','Before expenses',appMoney(metrics.salesTotal)],['Cost of Goods','Food and alcohol',appMoney(-metrics.cogs)],['Operating Labor & Expenses','Employee tips excluded',appMoney(-((metrics.employerLabor||metrics.operatingLabor)+metrics.expenseTotal))],['Tip Pass-Through','Employee-owned net tips · not deducted',appMoney(metrics.netTipsPaid)]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Vendor Spend': ['Vendor invoice totals and recent activity', [{title:'Top Vendors',rows:(metrics.topVendors.length?metrics.topVendors:[['No vendor data',0]]).map(([name,value])=>[name,'Invoice spend',appMoney(value)]),total:['Vendor Total',appMoney(metrics.invoiceTotal)]}]],
    'Food Cost': ['Full allocated Food Department economics', [{title:'True Food Cost',rows:trueFoodRows,total:['True Food Cost',appMoney(dc.trueFoodCost ?? metrics.foodCost)]},{title:'Food Cost Rate',rows:[['Food Sales','Selected period',appMoney(dc.foodSales ?? metrics.foodSales)]],total:['Food Cost %',appPercent(dc.foodCostPercent ?? metrics.foodCostPercent)]}]],
    'True Food Cost': ['Full allocated Food Department economics', [{title:'True Food Cost',rows:trueFoodRows,total:['True Food Cost',appMoney(dc.trueFoodCost ?? metrics.foodCost)]}]],
    'Alcohol Cost': ['Full allocated Alcohol Department economics', [{title:'True Alcohol Cost',rows:trueAlcoholRows,total:['True Alcohol Cost',appMoney(dc.trueAlcoholCost ?? metrics.alcoholCost)]},{title:'Alcohol Cost Rate',rows:[['Alcohol Sales','Selected period',appMoney(dc.alcoholSales ?? metrics.alcoholSales)]],total:['Alcohol Cost %',appPercent(dc.alcoholCostPercent ?? metrics.alcoholCostPercent)]}]],
    'True Alcohol Cost': ['Full allocated Alcohol Department economics', [{title:'True Alcohol Cost',rows:trueAlcoholRows,total:['True Alcohol Cost',appMoney(dc.trueAlcoholCost ?? metrics.alcoholCost)]}]],
    'Food Invoices': ['Food invoices in the selected period', [{title:'Food Invoices',rows:[['Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Food Invoice Total',appMoney(metrics.foodCost)]}]],
    'Alcohol Invoices': ['Alcohol invoices in the selected period', [{title:'Alcohol Invoices',rows:[['Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Alcohol Invoice Total',appMoney(metrics.alcoholCost)]}]],
    'Payroll Total': ['Payroll by job type, tips and payment methods', [{title:'Payroll by Job Type',rows:jobGroups,total:['Payroll Total',appMoney(metrics.payrollTotal)]},{title:'Payroll Classification',rows:[['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} allocated records`,appMoney(metrics.managementPayroll||0)],['Front of House Payroll',`${fohRows.length} excluded from Operating Labor`,appMoney(metrics.frontOfHousePayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned tips',appMoney(metrics.netTipsPaid)]],total:['Payroll Total',appMoney(metrics.payrollTotal)]},{title:'Payment Methods',rows:[['Cash Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').length} entries`,appMoney(metrics.cashPayroll)],['Check Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='check').length} entries`,appMoney(metrics.checkPayroll)],['Total Hours','Imported and manual labor',metrics.payrollHours.toFixed(1)]],total:['Payroll Total',appMoney(metrics.payrollTotal)]}]],
    'Cash Payroll': ['Cash payment employees', [{title:'Cash Payroll',rows:[['Cash Payroll','Current records',appMoney(metrics.cashPayroll)]],total:['Cash Payroll',appMoney(metrics.cashPayroll)]}]],
    'Check Payroll': ['Check payment employees', [{title:'Check Payroll',rows:[['Check Payroll','Current records',appMoney(metrics.checkPayroll)]],total:['Check Payroll',appMoney(metrics.checkPayroll)]}]],
    'Total Expenses': ['Operating expense totals', [{title:'Expenses',rows:[['All Expenses',`${expenses.length} records`,appMoney(metrics.expenseTotal)],['Cash Expenses','Cash payments',appMoney(metrics.cashExpenses)]],total:['Total Expenses',appMoney(metrics.expenseTotal)]}]],
    'Cash Expenses': ['Cash operating expenses in the selected period', [{title:'Cash Expenses',rows:[['Cash Expenses',`${expenses.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} matching records`,appMoney(metrics.cashExpenses)]],total:['Cash Expenses',appMoney(metrics.cashExpenses)]}]],
    'Check & ACH': ['Check and ACH operating expenses in the selected period', [{title:'Check & ACH',rows:[['Check & ACH',`${expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).length} matching records`,appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]],total:['Check & ACH',appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]}]],
    'Credit Expenses': ['Credit/card operating expenses in the selected period', [{title:'Credit Expenses',rows:[['Credit Expenses',`${expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).length} matching records`,appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]],total:['Credit Expenses',appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]}]],
    'Cash Vendor Invoices': ['Cash-paid vendor invoices in the selected period', [{title:'Cash Vendor Invoices',rows:[['Cash Vendor Invoices',`${invoices.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} matching invoices`,appMoney(metrics.cashInvoiceSpend)]],total:['Cash Vendor Invoices',appMoney(metrics.cashInvoiceSpend)]}]],
    'Invoice Total': ['Invoice totals and status', [{title:'Invoices',rows:[['All Invoices',`${invoices.length} records`,appMoney(metrics.invoiceTotal)]],total:['Invoice Total',appMoney(metrics.invoiceTotal)]}]],
    'Active Employees': ['Current employee records', [{title:'Employees',rows:[['Active Employees',`${employees.filter(r=>r.status!=='Inactive').length} active`,'Current'],['Total Employees',`${employees.length} records`,String(employees.length)]],total:['Employee Count',String(employees.length)]}]],
  }
  const selected = map[title]
  if (selected) return { tone, subtitle:selected[0], sections:selected[1] }
  return { tone, subtitle:'Selected period details', sections:[{title:'Summary',rows:[['Current Total','No calculation is configured for this KPI',appMoney(0)],['Entries','No related live collection is configured','0'],['Status','No live detail mapping','Review']],total:['Selected Total',appMoney(0)]}] }
}

function payrollEntryValue(row = {}) {
  const base = Number(row.regular_pay ?? row.base_pay ?? row.basePay ?? 0) || 0
  const tips = Number(row.net_tips ?? row.tips_after_withholding ?? row.credit_card_tips ?? row.tips ?? 0) || 0
  const extra = Number(row.extra_pay ?? 0) || 0
  return base + tips + extra
}

function expenseMethod(row = {}) { return String(row.method || row.payment_type || '').trim().toLowerCase() }
function invoiceMethod(row = {}) { return String(row.payment_type || row.method || '').trim().toLowerCase() }
function payrollMethod(row = {}) { return String(row.payment_method || row.method || '').trim().toLowerCase() }
function invoiceCategory(row = {}) { return String(row.category || row.invoice_category || '').trim().toLowerCase() }
function salesCategoryText(row = {}) { return String(row.category || row.department || row.sales_department || '').trim().toLowerCase() }
function vendorName(row = {}) { return String(row.vendor || row.vendor_name || row.name || '').trim() }

function entryTriples(rows = [], kind = '') {
  return rows.map((r) => {
    if (kind === 'expense') return [r.date || r.expense_date || '—', `${r.vendor || 'Vendor'} · ${r.type || r.expense_type || r.category || 'Expense'} · ${r.method || r.payment_type || 'Method'}`, appMoney2(r.amount ?? r.total)]
    if (kind === 'invoice') {
      const role = r.comparison_role ? `${r.comparison_role} · ` : ''
      const purchaseUnit = r.purchase_unit || r.sales_unit || r.unit || 'Each'
      const pack = Number(r.pack_count || 0) > 1 ? ` · ${r.pack_count}/case` : ''
      const original = Number(r.case_price || 0) ? ` · original ${appMoney2(r.case_price)}/${purchaseUnit === 'case' ? 'case' : purchaseUnit}` : ''
      const normalized = Number(r.effective_each_cost || r.normalized_unit_cost || r.unit_cost || 0)
      const basis = r.comparison_basis === 'each' ? 'bottle/each' : (r.comparison_basis || r.normalized_unit || purchaseUnit)
      return [r.date || r.invoice_date || '—', `${role}${vendorName(r) || 'Vendor'} · ${r.invoice_number || r.number || 'Invoice'} · ${purchaseUnit}${pack}${r.package_size ? ` · ${r.package_size}` : ''}${original} · basis ${basis}`, appMoney2(normalized || r.line_total || r.amount || r.total)]
    }
    if (kind === 'payroll') return [r.pay_date || r.payroll_date || r.date || '—', `${r.employee_name || r.employee || 'Employee'} · ${r.job_type || r.job || 'Job'} · ${r.payment_method || r.method || 'Method'}`, appMoney2(r._display_amount ?? payrollEntryValue(r))]
    if (kind === 'employee') return [r.created_at ? String(r.created_at).slice(0,10) : '—', `${r.name || r.employee_name || 'Employee'} · ${r.job || r.job_type || 'Job'}`, r.status || 'Active']
    if (kind === 'vendor') return [r.created_at ? String(r.created_at).slice(0,10) : '—', `${r.name || r.vendor_name || 'Vendor'} · ${r.category || 'Other'}`, r.status || (r.is_active === false ? 'Inactive' : 'Active')]
    return [r.business_date || r.date || '—', `${r.category || r.department || 'Sales'} · ${r.source || 'Toast POS'}`, appMoney2(r.net_sales ?? r.amount ?? r.sales ?? 0)]
  })
}

function buildRecentEntries(title, collections, explicitEntries = []) {
  if (Array.isArray(explicitEntries) && explicitEntries.length) {
    const sample = explicitEntries[0] || {}
    const kind = ('employee_name' in sample || 'regular_pay' in sample || 'base_pay' in sample) ? 'payroll'
      : ('invoice_number' in sample || 'invoice_date' in sample || 'line_total' in sample) ? 'invoice'
      : ('expense_date' in sample || 'payment_type' in sample || 'expense_type' in sample) ? 'expense'
      : ('business_date' in sample || 'net_sales' in sample || 'cash_sales' in sample) ? 'sales'
      : ('vendor_type' in sample || 'expense_type' in sample) ? 'vendor' : 'sales'
    return entryTriples(explicitEntries, kind)
  }

  const label = String(title || '').trim()
  const lowerLabel = label.toLowerCase()
  let rows = []
  let kind = 'sales'

  if (lowerLabel === 'prime cost') {
    const food = entryTriples(collections.invoices.filter(r => /food|meat|seafood|produce|dairy|dry goods|frozen|bakery/.test(invoiceCategory(r))), 'invoice')
    const alcohol = entryTriples(collections.invoices.filter(r => /alcohol|beer|wine|liquor|margarita|cocktail|shot/.test(invoiceCategory(r))), 'invoice')
    const laborRows = collections.payroll.map(r=>({...r,_display_amount:Math.max(0,payrollEntryValue(r)-(Number(r.net_tips??r.tips_after_withholding??r.credit_card_tips??r.tips??0)||0))})).filter(r=>r._display_amount>0)
    const labor = entryTriples(laborRows, 'payroll')
    return [...food,...alcohol,...labor].sort((a,b)=>String(b[0]).localeCompare(String(a[0])))
  }
  if (lowerLabel === 'operating labor') { rows = collections.payroll.filter(r=>payrollCostClass(r)==='operating-labor'); kind='payroll' }
  else if (lowerLabel === 'management payroll' || lowerLabel === 'management allocation' || lowerLabel === 'manager allocation') { rows = collections.payroll.filter(r=>payrollCostClass(r)==='management'); kind='payroll' }
  else if (lowerLabel === 'front of house payroll' || lowerLabel === 'front of house wages') { rows = collections.payroll.filter(r=>payrollCostClass(r)==='front-of-house'); kind='payroll' }
  else if (lowerLabel === 'unmapped payroll') { rows = collections.payroll.filter(r=>payrollCostClass(r)==='review'); kind='payroll' }
  else if (lowerLabel === 'tip pass-through') { rows = collections.payroll.filter(r=>Number(r.net_tips??r.tips_after_withholding??r.credit_card_tips??r.tips??0)!==0).map(r=>({...r,regular_pay:0,base_pay:0,extra_pay:0})); kind='payroll' }
  else if (lowerLabel === 'cash expenses') { rows = collections.expenses.filter(r => expenseMethod(r) === 'cash'); kind = 'expense' }
  else if (/^(check\s*(?:&|\/|and)\s*ach|check \/ ach)$/i.test(label)) { rows = collections.expenses.filter(r => ['check','ach'].includes(expenseMethod(r))); kind = 'expense' }
  else if (lowerLabel === 'credit expenses') { rows = collections.expenses.filter(r => /credit|card/.test(expenseMethod(r))); kind = 'expense' }
  else if (/^(total expenses|business expenses|all expenses|expenses)$/i.test(label)) { rows = collections.expenses; kind = 'expense' }
  else if (lowerLabel === 'cash vendor invoices') { rows = collections.invoices.filter(r => invoiceMethod(r) === 'cash'); kind = 'invoice' }
  else if (/^(all invoices|invoice total)$/i.test(label)) { rows = collections.invoices; kind = 'invoice' }
  else if (/food purchases|food invoices|food cost|true food cost/i.test(label)) { rows = collections.invoices.filter(r => /food|meat|seafood|produce|dairy|dry goods|frozen|bakery/.test(invoiceCategory(r))); kind = 'invoice' }
  else if (/alcohol purchases|alcohol invoices|alcohol cost|true alcohol cost/i.test(label)) { rows = collections.invoices.filter(r => /alcohol|beer|wine|liquor|margarita|cocktail|shot/.test(invoiceCategory(r))); kind = 'invoice' }
  else if (lowerLabel === 'cash payroll') { rows = collections.payroll.filter(r => payrollMethod(r) === 'cash'); kind = 'payroll' }
  else if (lowerLabel === 'check payroll') { rows = collections.payroll.filter(r => payrollMethod(r) === 'check'); kind = 'payroll' }
  else if (/^(payroll|payroll total|labor cost)$/i.test(label)) { rows = collections.payroll; kind = 'payroll' }
  else if (/active employees/i.test(label)) { rows = collections.employees.filter(r => String(r.status || 'Active').toLowerCase() !== 'inactive'); kind = 'employee' }
  else if (/total employees|employee count/i.test(label)) { rows = collections.employees; kind = 'employee' }
  else if (/vendor spend|all vendors|total vendors/i.test(label)) { rows = collections.vendors; kind = 'vendor' }
  else if (/cash sales|cash collected/i.test(label)) { rows = collections.sales.filter(r => Number(r.cash_sales || 0) !== 0); kind = 'sales' }
  else if (/credit sales/i.test(label)) { rows = collections.sales.filter(r => Number(r.credit_sales || 0) !== 0); kind = 'sales' }
  else if (/food sales/i.test(label)) { rows = collections.sales.filter(r => /food/.test(salesCategoryText(r))); kind = 'sales' }
  else if (/alcohol sales/i.test(label)) { rows = collections.sales.filter(r => /alcohol|beer|wine|liquor|margarita|cocktail/.test(salesCategoryText(r))); kind = 'sales' }
  else if (/tips/i.test(label)) { rows = collections.sales.filter(r => Number(r.tips_collected ?? r.tips ?? 0) !== 0).map(r => ({...r, net_sales:r.tips_collected ?? r.tips})); kind = 'sales' }
  else if (/sale|cash flow|cash remaining|operating profit|prime cost|labor mix/i.test(label)) { rows = collections.sales; kind = 'sales' }
  else if (/invoice|cost/i.test(label)) { rows = collections.invoices; kind = 'invoice' }
  else if (/expense/i.test(label)) { rows = collections.expenses; kind = 'expense' }
  else if (/payroll|labor/i.test(label)) { rows = collections.payroll; kind = 'payroll' }
  else {
    const expenseMatches = collections.expenses.filter(r => String(r.expense_type||r.type||r.category||'').trim().toLowerCase() === lowerLabel)
    const jobMatches = collections.payroll.filter(r => String(r.job_type||r.job||r.position||r.role||'').trim().toLowerCase() === lowerLabel)
    const vendorMatches = collections.invoices.filter(r => vendorName(r).toLowerCase() === lowerLabel)
    if (expenseMatches.length) { rows = expenseMatches; kind = 'expense' }
    else if (jobMatches.length) { rows = jobMatches; kind = 'payroll' }
    else if (vendorMatches.length) { rows = vendorMatches; kind = 'invoice' }
  }

  return entryTriples(rows, kind)
}

const routeMap = {
  'Net Sales':'/sales','Cash Sales':'/sales','Credit Sales':'/sales','Other Sales':'/sales','Tips Earned':'/sales','Sales Summary':'/sales','Cash Flow':'/sales','Cash Collected':'/sales','Cash Remaining':'/sales','Prime Cost':'/food-alcohol-cost','Labor Mix':'/payroll','Operating Profit':'/reports','Business Expenses':'/expenses',
  'Cost Breakdown':'/food-alcohol-cost','Food Cost':'/food-alcohol-cost','Alcohol Cost':'/food-alcohol-cost','True Food Cost':'/food-alcohol-cost','True Alcohol Cost':'/food-alcohol-cost',
  'Food Invoices':'/invoices','Alcohol Invoices':'/invoices','Invoice Total':'/invoices','Open Balance':'/invoices',
  'Vendor Spend':'/vendors','Total Vendors':'/vendors','Inventory Vendors':'/vendors','Expense Vendors':'/vendors',
  'Compared Items':'/vendor-comparison','Best Savings':'/vendor-comparison','Matched Sizes':'/vendor-comparison','Potential Savings':'/vendor-comparison',
  'Items Increased':'/price-increase','Average Increase':'/price-increase','Largest Increase':'/price-increase','Items Decreased':'/price-increase',
  'Total Employees':'/employees','Active Employees':'/employees','Kitchen Staff':'/employees','Front of House':'/employees','Weekly Base Pay':'/employees',
  'Payroll Total':'/payroll','Cash Payroll':'/payroll','Check Payroll':'/payroll','Total Hours':'/payroll',
  'Total Expenses':'/expenses','Cash Expenses':'/expenses','Check & ACH':'/expenses','Check / ACH':'/expenses','Credit Expenses':'/expenses',
  'Bank Activity':'/bank-checks','Cleared Payments':'/bank-checks','Pending Payments':'/bank-checks','Checks Issued':'/bank-checks',
  'Sales Imports':'/import-center','Labor Imports':'/import-center','Invoice Imports':'/import-center','Completed':'/import-center',
  'Connection Status':'/toast-integration','Last Sales Sync':'/toast-integration','Last Labor Sync':'/toast-integration','Pending Jobs':'/toast-integration',
}

export default function DetailDrawer({ title, entries = [], initialTab = 'Overview', onClose }) {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [expanded, setExpanded] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [entryScope, setEntryScope] = useState('')
  const [notes, setNotes] = useState('')
  const { range: globalRange } = useGlobalDateRange()
  const [drawerRange, setDrawerRange] = useState(() => readDateRange())
  const [draftRange, setDraftRange] = useState(() => readDateRange())
  const appData = useAppData(drawerRange)
  const { metrics, sales, invoices, expenses, payroll, vendors, employees } = appData
  const content = useMemo(() => buildDrawerContent(title, appData), [title, appData])

  useEffect(() => {
    setActiveTab(initialTab); setExpanded(initialTab === 'Entries'); setSelectedRow(null); setEntryScope('')
    const activeRange = readDateRange()
    setDrawerRange(activeRange); setDraftRange(activeRange)
    if (title) setNotes(localStorage.getItem(`restapay.drawer.notes.${title}`) || '')
  }, [title, initialTab, globalRange.from, globalRange.to, globalRange.preset])

  const categoryRows = useMemo(() => {
    const preferred = title === 'Business Expenses' ? ['Expense Categories'] : title === 'Payroll Total' ? ['Payroll by Job Type'] : []
    const sections = preferred.length ? content.sections.filter(section=>preferred.includes(section.title)) : content.sections
    return sections.flatMap((section) => section.rows.map((row) => ({ section: section.title, row })))
  }, [content, title])
  const recentEntries = useMemo(() => buildRecentEntries(entryScope || title, { sales, invoices, expenses, payroll, vendors, employees }, entries), [entryScope, title, entries, sales, invoices, expenses, payroll, vendors, employees])
  if (!title) return null

  const openWorkspace = () => { const target = routeMap[entryScope] || routeMap[title] || '/dashboard'; onClose?.(); navigate(target) }
  const showMatchingEntries = (label) => { setSelectedRow(null); setEntryScope(label || title); setActiveTab('Entries'); setExpanded(true) }
  const exportDrawer = () => {
    const csv = [['Section','Item','Details','Value'], ...categoryRows.map(({section,row}) => [section,...row])]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-details.csv`; anchor.click(); URL.revokeObjectURL(url)
    notify(`${title} details exported.`)
  }
  const saveNotes = () => { localStorage.setItem(`restapay.drawer.notes.${title}`, notes); notify(`${title} notes saved locally.`) }
  const handleDrawerPreset = (preset) => {
    const dates = presetDates(preset)
    setDraftRange(dates || { ...draftRange, preset:'custom' })
  }
  const applyDrawerRange = () => {
    if (!draftRange.from || !draftRange.to) return notify('Choose both From and To dates.', 'error')
    if (draftRange.from > draftRange.to) return notify('From date cannot be after To date.', 'error')
    setDrawerRange({ ...draftRange })
  }

  return <div className="drawer-layer" role="presentation" onMouseDown={onClose}>
    <aside className={`detail-drawer drawer-${content.tone} ${expanded ? 'drawer-expanded' : ''}`} role="dialog" aria-modal="true" aria-label={`${title} details`} onMouseDown={(event) => event.stopPropagation()}>
      <header className="drawer-header"><div><h2>{title}</h2><p>{content.subtitle}</p></div><div className="drawer-header-actions">
        <button type="button" className="drawer-icon-button" aria-label={expanded ? 'Restore size' : 'Expand'} onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={18}/> : <Expand size={18}/>}</button>
        <button type="button" className="drawer-icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button>
      </div></header>
      <div className="drawer-range drawer-range-controls" style={{display:'grid',gap:12}}>
        <div className="drawer-range-current" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}><span>Date Range</span><strong>{formatRangeDate(drawerRange.from)} — {formatRangeDate(drawerRange.to)}</strong></div>
        <div className="drawer-range-editor" style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',width:'100%'}}>
          <select aria-label="Detail date range preset" value={draftRange.preset || 'custom'} onChange={event => handleDrawerPreset(event.target.value)} style={{minHeight:42,minWidth:150}}>
            <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This Week</option><option value="last-week">Last Week</option><option value="month">This Month</option><option value="last-month">Last Month</option><option value="quarter">This Quarter</option><option value="last-quarter">Last Quarter</option><option value="year">This Year</option><option value="last-year">Last Year</option><option value="custom">Custom Range</option>
          </select>
          <input aria-label="Detail range from" type="date" value={draftRange.from || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',from:event.target.value})} style={{minHeight:42}}/>
          <span>—</span>
          <input aria-label="Detail range to" type="date" value={draftRange.to || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',to:event.target.value})} style={{minHeight:42}}/>
          <button type="button" onClick={applyDrawerRange} style={{minHeight:42,padding:'0 18px',fontWeight:700}}>Apply</button>
        </div>
      </div>
      <nav className="drawer-tabs" aria-label="Detail sections">{['Overview','By Category','Entries','Notes'].map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} type="button" onClick={() => { setActiveTab(tab); setSelectedRow(null); if (tab !== 'Entries') setEntryScope('') }}>{tab}</button>)}</nav>

      <div className="drawer-scroll">
        {activeTab === 'Overview' && <>{content.sections.map((section) => <section className="drawer-section" key={section.title}><h3>{section.title}</h3>{section.rows.map(([label,meta,value]) => <button className={`drawer-row ${/tip pass-through/i.test(label) ? 'drawer-row-excluded' : ''}`} type="button" key={`${section.title}-${label}`} onClick={() => showMatchingEntries(label)}><span><strong>{label}</strong><small>{meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}<div className="drawer-total"><strong>{section.total[0]}</strong><b>{section.total[1]}</b></div></section>)}
          {selectedRow && <section className="drawer-section drawer-drilldown"><div className="drawer-section-heading"><h3>{selectedRow.label} Details</h3><button onClick={() => setSelectedRow(null)}>Close</button></div><div className="drawer-detail-grid"><div><small>Section</small><strong>{selectedRow.section}</strong></div><div><small>Current Value</small><strong>{selectedRow.value}</strong></div><div><small>Description</small><strong>{selectedRow.meta}</strong></div><div><small>Status</small><strong className="drawer-ready"><CheckCircle2 size={15}/>Ready</strong></div></div><button className="drawer-inline-action" onClick={openWorkspace}>Open related records<ChevronRight size={16}/></button></section>}
        </>}

        {activeTab === 'By Category' && <section className="drawer-section"><h3>Category Breakdown</h3>{categoryRows.map(({section,row:[label,meta,value]}) => <button className={`drawer-row ${/tip pass-through/i.test(label) ? 'drawer-row-excluded' : ''}`} type="button" key={`${section}-${label}`} onClick={() => showMatchingEntries(label)}><span><strong>{label}</strong><small>{section} · {meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}</section>}

        {activeTab === 'Entries' && <section className="drawer-section"><div className="drawer-section-heading"><div><h3>{entryScope || title} Entries</h3><small>{recentEntries.length} matching record{recentEntries.length === 1 ? '' : 's'} shown for the selected date range</small></div><button type="button" onClick={openWorkspace}>Open workspace</button></div>{recentEntries.length ? recentEntries.map(([date,meta,value], index) => <div className="drawer-row drawer-entry-row" key={`${date}-${meta}-${index}`}><span><strong>{date}</strong><small>{meta}</small></span><b>{value}</b></div>) : <div className="drawer-empty">No matching records for this total and date range.</div>}</section>}

        {activeTab === 'Notes' && <section className="drawer-section drawer-notes"><h3>Notes</h3><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Add notes for ${title}...`}/><button type="button" className="drawer-inline-action" onClick={saveNotes}><Save size={16}/>Save Notes</button></section>}
      </div>

      <footer className="drawer-footer"><button type="button" className="secondary-action" onClick={exportDrawer}><Download size={17}/>Export</button><button type="button" className="secondary-action" onClick={() => window.print()}><Printer size={17}/>Print</button><button type="button" className="drawer-primary" onClick={openWorkspace}>Open Workspace<ChevronRight size={18}/></button></footer>
    </aside>
  </div>
}
