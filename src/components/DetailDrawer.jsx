import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, Download, Expand, Minimize2, Pencil, Printer, Save, Trash2, X } from 'lucide-react'
import { useFeedback } from './AppFeedback'
import { useNavigate } from 'react-router-dom'
import { appMoney, appMoney2, appPercent, useAppData } from '../hooks/useAppData'
import useGlobalDateRange, { presetDates, readDateRange, inDateRange } from '../hooks/useGlobalDateRange'
import { payrollCostClass } from '../core/adapters/payrollAdapter.js'
import { replaceLiveCollection } from '../data/liveDataStore.js'


const rowsTotal = (rows, field = 'amount') => rows.reduce((sum,row) => sum + (Number(row[field] ?? row.total ?? 0) || 0), 0)
const salesCategory = (rows, pattern) => rows.filter(row => pattern.test(String(row.category || row.department || ''))).reduce((sum,row)=>sum+(Number(row.amount||0)||0),0)
const formatRangeDate = value => { if (!value) return '—'; const [y,m,d] = String(value).split('-').map(Number); const date = y&&m&&d ? new Date(y,m-1,d) : new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US',{month:'short',day:'2-digit',year:'numeric'}) }

function buildDrawerContent(title, { metrics, sales, invoices, expenses, payroll, vendors, employees }, explicitEntries = []) {
  const tone = /cost|expense|alcohol/i.test(title || '') ? 'orange' : /profit|cash|food/i.test(title || '') ? 'green' : /vendor|payroll|labor|employee/i.test(title || '') ? 'purple' : 'blue'
  const dc = metrics.departmentCosts || {}
  const operatingRows = metrics.payrollSummary?.operatingRows || payroll.filter(row=>payrollCostClass(row)==='operating-labor')
  const managementRows = metrics.payrollSummary?.managementRows || payroll.filter(row=>payrollCostClass(row)==='management')
  const fohRows = metrics.payrollSummary?.frontOfHouseRows || payroll.filter(row=>payrollCostClass(row)==='front-of-house')
  const reviewRows = metrics.payrollSummary?.reviewRows || payroll.filter(row=>payrollCostClass(row)==='review')
  const salesRows = [['Food Sales','Food department',appMoney(dc.foodSales ?? metrics.foodSales)],['Alcohol Sales','Beer, wine and liquor',appMoney(dc.alcoholSales ?? metrics.alcoholSales)],['Other Sales','Other categories',appMoney(metrics.otherSales)]]
  const paymentRows = [['Cash Sales','Cash payments',appMoney(metrics.cashSales)],['Credit Sales','Card payments',appMoney(metrics.creditSales)],['Tips','Excluded from profit',appMoney(metrics.tips)]]
  const operatingExpenseRows = expenses.filter(row=>!/cash withdrawal|owner withdrawal|cash draw/i.test(`${row.category||''} ${row.type||''} ${row.name||''} ${row.payment_type||''}`))
  const expenseGroups = Object.values(operatingExpenseRows.reduce((acc,row)=>{const label=String(row.expense_type||row.type||row.category||'Other').trim()||'Other';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0,total:0};acc[key].count+=1;acc[key].total+=Number(row.amount??row.total??0)||0;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} record${g.count===1?'':'s'}`,appMoney(g.total)])
  const classifiedPayrollRows = [...operatingRows,...managementRows,...fohRows,...reviewRows]
  const jobGroups = Object.values(classifiedPayrollRows.reduce((acc,row)=>{const label=String(row.job_type||row.job||row.position||row.role||'Unassigned / Review').trim()||'Unassigned / Review';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0,total:0};acc[key].count+=1;acc[key].total+=payrollEntryValue(row);return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} payroll record${g.count===1?'':'s'}`,appMoney(g.total)])
  const trueFoodRows = [['Direct Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(dc.directFoodCost ?? metrics.foodCost)],['Kitchen Payroll',`${dc.payrollDetails?.kitchen?.length||operatingRows.length} operating labor entries`,appMoney(dc.kitchenPayroll ?? metrics.operatingLabor)],['Manager Allocation',`${dc.payrollDetails?.manager?.length||managementRows.length} management entries`,appMoney(dc.managerFood||0)],['Supplies Allocation',`${dc.rules?.supplies?.food??0}% Food`,appMoney(dc.foodSupplies||0)],['Shared Costs','Cleaning · Cintas · Utilities · Insurance · Other',appMoney(dc.foodShared||0)],['Food Sales','Matching department sales',appMoney(dc.foodSales ?? metrics.foodSales)]]
  const invoiceCategoryGroups = Object.values(invoices.reduce((acc,invoice)=>{
    const lines=Array.isArray(invoice.lines)&&invoice.lines.length?invoice.lines:[invoice]
    lines.forEach(line=>{
      const label=String(line.category||invoice.category||'Other').trim()||'Other'
      const key=label.toLowerCase()
      if(!acc[key]) acc[key]={label,count:0,total:0}
      acc[key].count+=1
      acc[key].total+=Number(line.line_total??line.amount??line.total??invoice.amount??invoice.total??0)||0
    })
    return acc
  },{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} line${g.count===1?'':'s'}`,appMoney(g.total)])
  const vendorCategoryGroups = Object.values(vendors.reduce((acc,row)=>{const label=String(row.category||'Other').trim()||'Other';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0};acc[key].count++;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} vendor${g.count===1?'':'s'}`,String(g.count)])
  const vendorExpenseGroups = Object.values(vendors.reduce((acc,row)=>{const label=String(row.expenseType||row.expense_type||'Other').trim()||'Other';const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0};acc[key].count++;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} vendor${g.count===1?'':'s'}`,String(g.count)])
  const priceRows = metrics.priceComparisons||[]
  const priceIncreaseRows = priceRows.filter(r=>Number(r.change||0)>0)
  const priceDecreaseRows = priceRows.filter(r=>Number(r.change||0)<0)
  const priceImpact = priceIncreaseRows.reduce((sum,r)=>sum+(Number(r.change||0)||0),0)
  const trueAlcoholRows = [['Direct Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(dc.directAlcoholCost ?? metrics.alcoholCost)],['Bar Payroll',`${dc.payrollDetails?.bar?.length||0} bar payroll entries`,appMoney(dc.barPayroll||0)],['Manager Allocation',`${dc.payrollDetails?.manager?.length||managementRows.length} management entries`,appMoney(dc.managerAlcohol||0)],['Supplies / Shared Allocation','Allocated shared operating costs',appMoney(dc.alcoholShared||0)],['Alcohol Sales','Matching department sales',appMoney(dc.alcoholSales ?? metrics.alcoholSales)]]
  const primeRows = [['Direct Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['Direct Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} management records · included once`,appMoney(metrics.managementPayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned net tips',appMoney(metrics.netTipsPaid)]]
  const costRows = [...primeRows,['Management Payroll',`${managementRows.length} records · allocated in department economics`,appMoney(metrics.managementPayroll||0)],['Front of House Wages',`${fohRows.length} records · excluded from Operating Labor`,appMoney(metrics.frontOfHousePayroll||0)],['Unmapped Payroll',`${reviewRows.length} records · review classification`,appMoney(metrics.reviewPayroll||0)]]
  const map = {
    'Net Sales': ['Sales by category and payment type', [{title:'Sales by Category',rows:salesRows,total:['Net Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Payments',appMoney(metrics.salesTotal)]}]],
    'Cash Flow': ['Cash collected less cash payroll, cash invoices and cash expenses', [{title:'Cash Flow',rows:[['Carry Forward','Prior-period cash balance',appMoney(metrics.cashCarryForward||0)],['Cash Collected',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} sales days`,appMoney(metrics.cashSales)],['Cash Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').length} payroll entries`,appMoney(-metrics.cashPayroll)],['Cash Vendor Invoices',`${invoices.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} invoices`,appMoney(-metrics.cashInvoiceSpend)],['Cash Expenses',`${expenses.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} expense entries`,appMoney(-metrics.cashExpenses)],['Cash Withdrawals',`${metrics.cashWithdrawalRows?.length||0} withdrawals`,appMoney(-(metrics.cashWithdrawals||0))]],total:['Cash Remaining',appMoney(metrics.cashRemaining)]}]],
    'Cash Collected': ['Cash sales for the selected period', [{title:'Cash Collected',rows:[['Cash Sales',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} daily records`,appMoney(metrics.cashSales)]],total:['Cash Collected',appMoney(metrics.cashSales)]}]],
    'Cash Remaining': ['Cash collected less cash payroll, cash invoices and expenses', [{title:'Cash Remaining',rows:[['Carry Forward','Prior-period cash balance',appMoney(metrics.cashCarryForward||0)],['Cash Collected','Sales cash receipts',appMoney(metrics.cashSales)],['Cash Payroll','Cash payroll payments',appMoney(-metrics.cashPayroll)],['Cash Vendor Invoices','Cash-paid vendor invoices',appMoney(-metrics.cashInvoiceSpend)],['Cash Expenses','Cash operating expenses',appMoney(-metrics.cashExpenses)],['Cash Withdrawals','Recorded cash withdrawals',appMoney(-(metrics.cashWithdrawals||0))],['Cash Adjustments','Balance reconciliation adjustments',appMoney(metrics.cashAdjustments||0)]],total:['Cash Remaining',appMoney(metrics.cashRemaining)]}]],
    'Prime Cost': ['Direct food/alcohol purchases plus BOH operating labor; tips excluded', [{title:'Prime Cost',rows:primeRows,total:['Prime Cost',appMoney(metrics.primeCostAmount)]}]],
    'Labor Mix': ['BOH operating labor compared with sales; management, FOH and employee tips are shown separately', [{title:'Labor Mix',rows:[['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} records · allocated separately`,appMoney(metrics.managementPayroll||0)],['Front of House Payroll',`${fohRows.length} records · excluded from Operating Labor`,appMoney(metrics.frontOfHousePayroll||0)],['Unmapped Payroll',`${reviewRows.length} records · review classification`,appMoney(metrics.reviewPayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned net tips',appMoney(metrics.netTipsPaid)],['Net Sales',`${sales.length} sales days`,appMoney(metrics.salesTotal)]],total:['Labor Mix',appMoney((metrics.operatingLabor||0)+(metrics.managementPayroll||0))]}]],
    'Operating Profit': ['Sales less food, alcohol, operating labor and expenses', [{title:'Operating Profit',rows:[['Net Sales',`${sales.length} sales days`,appMoney(metrics.salesTotal)],['Cost of Goods','Food and alcohol',appMoney(-metrics.cogs)],['Employer Labor Cost','BOH + management + FOH wages · employee tips excluded',appMoney(-(metrics.employerLabor||metrics.operatingLabor))],['Tip Pass-Through','Employee-owned net tips · not deducted',appMoney(metrics.netTipsPaid)],['Expenses',`${expenses.length} records`,appMoney(-metrics.expenseTotal)]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Business Expenses': ['Operating expenses in the selected period', [{title:'Expense Categories',rows:expenseGroups,total:['Business Expenses',appMoney(metrics.expenseTotal)]},{title:'Payment Methods',rows:[['Cash Expenses','Cash payments',appMoney(metrics.cashExpenses)],['Check & ACH','Check / ACH payments',appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((s,r)=>s+(Number(r.amount||r.total||0)||0),0))],['Credit Expenses','Credit/card payments',appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((s,r)=>s+(Number(r.amount||r.total||0)||0),0))]],total:['All Payment Methods',appMoney(metrics.expenseTotal)]}]],
    'Cash Sales': ['Actual cash sales and payments', [{title:'Cash Activity',rows:[['Cash Sales',`${sales.filter(r=>Number(r.cash_sales||0)!==0).length} daily records`,appMoney(metrics.cashSales)]],total:['Cash Sales',appMoney(metrics.cashSales)]}]],
    'Credit Sales': ['Card and debit activity', [{title:'Credit Activity',rows:[['Credit Sales',`${sales.filter(r=>Number(r.credit_sales||0)!==0).length} daily records`,appMoney(metrics.creditSales)]],total:['Credit Sales',appMoney(metrics.creditSales)]}]],
    'Other Sales': ['Other payment activity', [{title:'Other Activity',rows:[['Other Sales','Delivery and other',appMoney(metrics.otherSales)]],total:['Other Sales',appMoney(metrics.otherSales)]}]],
    'Tips Earned': ['Customer tips kept separate from profit', [{title:'Tip Activity',rows:[['Tips',`${sales.length} sales records`,appMoney(metrics.tips)]],total:['Tips Earned',appMoney(metrics.tips)]}]],
    'Sales Summary': ['Detailed breakdown of sales', [{title:'Sales Breakdown',rows:salesRows,total:['Total Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Total Payments',appMoney(metrics.salesTotal)]}]],
    'Cost Breakdown': ['Food, alcohol, labor and prime cost', [{title:'Current Period Costs',rows:costRows,total:['Prime Cost',appMoney(metrics.primeCostAmount)]}]],
    'Profit Summary': ['Income, deductions and operating profit with every labor group visible', [{title:'Profit Detail',rows:[['Gross Sales','Before costs and operating expenses',appMoney(metrics.salesTotal)],['Cost of Goods','Direct Food + Alcohol purchases',appMoney(-metrics.cogs)],['Operating Labor',`${operatingRows.length} Kitchen / BOH payroll records`,appMoney(-(metrics.operatingLabor||0))],['Management Payroll',`${managementRows.length} management payroll records`,appMoney(-(metrics.managementPayroll||0))],['Front of House Payroll',`${fohRows.length} FOH payroll records`,appMoney(-(metrics.frontOfHousePayroll||0))],['Operating Expenses',`${operatingExpenseRows.length} operating expense records`,appMoney(-metrics.expenseTotal)],['Tip Pass-Through','Employee-owned net tips · EXCLUDED from profit deductions',appMoney(metrics.netTipsPaid)]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Vendor Spend': ['Vendor invoice totals and recent activity', [{title:'Top Vendors',rows:(metrics.topVendors.length?metrics.topVendors:[['No vendor data',0]]).map(([name,value])=>[name,'Invoice spend',appMoney(value)]),total:['Vendor Total',appMoney(metrics.invoiceTotal)]}]],
    'Total Vendors': ['All vendors with category and expense-type breakdowns', [{title:'Vendors by Category',rows:vendorCategoryGroups,total:['Total Vendors',String(vendors.length)]},{title:'Vendors by Expense Type',rows:vendorExpenseGroups,total:['Total Vendors',String(vendors.length)]}]],
    'Inventory Vendors': ['Inventory-purchase vendors by category', [{title:'Inventory Vendors',rows:vendorCategoryGroups,total:['Inventory Vendors',String(vendors.filter(r=>String(r.type||r.vendor_type)==='Inventory Purchase').length)]}]],
    'Expense Vendors': ['Operating-expense vendors by expense type', [{title:'Expense Vendors',rows:vendorExpenseGroups,total:['Expense Vendors',String(vendors.filter(r=>String(r.type||r.vendor_type)!=='Inventory Purchase').length)]}]],
    'Invoice Total': ['Invoice spend broken down by line-item category', [{title:'Invoices by Category',rows:[['All Invoices',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)],...invoiceCategoryGroups],total:['Invoice Total',appMoney(metrics.invoiceTotal)]}]],
    'Open Balance': ['Invoices that are not marked paid or void', [{title:'Open Invoices',rows:invoices.filter(r=>!/paid|void/i.test(String(r.status||''))).map(r=>[r.vendor||r.vendor_name||'Vendor',`${r.invoice_number||r.number||'Invoice'} · ${r.date||r.invoice_date||'—'}`,appMoney(r.total||r.amount||0)]),total:['Open Balance',appMoney(invoices.filter(r=>!/paid|void/i.test(String(r.status||''))).reduce((sum,r)=>sum+(Number(r.total||r.amount||0)||0),0))]}]],
    'Price Increases': ['Items whose normalized current cost is above the previous cost', [{title:'Price Increases',rows:priceIncreaseRows.map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'}`,`${Number(r.change_percent||0).toFixed(1)}%`]),total:['Items Increased',String(priceIncreaseRows.length)]}]],
    'Items Increased': ['Items whose normalized current cost is above the previous cost', [{title:'Price Increases',rows:priceIncreaseRows.map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'}`,`${Number(r.change_percent||0).toFixed(1)}%`]),total:['Items Increased',String(priceIncreaseRows.length)]}]],
    'Items Decreased': ['Items whose normalized current cost is below the previous cost', [{title:'Price Decreases',rows:priceDecreaseRows.map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'}`,`${Number(r.change_percent||0).toFixed(1)}%`]),total:['Items Decreased',String(priceDecreaseRows.length)]}]],
    'Largest Increase': ['Highest normalized item cost increase', [{title:'Largest Increase',rows:priceIncreaseRows.slice().sort((a,b)=>Number(b.change_percent||0)-Number(a.change_percent||0)).slice(0,10).map(r=>[r.item||'Item',r.vendor||'Vendor',`${Number(r.change_percent||0).toFixed(1)}%`]),total:['Largest Increase',priceIncreaseRows.length?`${Math.max(...priceIncreaseRows.map(r=>Number(r.change_percent||0))).toFixed(1)}%`:'0.0%']}]],
    'Unit Impact': ['Sum of normalized unit-cost increases', [{title:'Unit Impact',rows:priceIncreaseRows.map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'}`,appMoney2(r.change||0)]),total:['Unit Impact',appMoney2(priceImpact)]}]],
    'Compared Items': ['All items with comparable price history', [{title:'Compared Items',rows:priceRows.map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.best_vendor||'Best vendor'}`,appMoney2(r.current_price||0)]),total:['Compared Items',String(priceRows.length)]}]],
    'Potential Savings': ['Potential normalized savings from best-vendor comparisons', [{title:'Potential Savings',rows:priceRows.filter(r=>Number(r.savings||r.potential_savings||0)>0).map(r=>[r.item||'Item',r.best_vendor||'Best vendor',appMoney2(r.savings||r.potential_savings||0)]),total:['Potential Savings',appMoney2(priceRows.reduce((sum,r)=>sum+(Number(r.savings||r.potential_savings||0)||0),0))]}]],
    'Best Vendor Matches': ['Items with comparable normalized prices from multiple vendors', [{title:'Best Vendor Matches',rows:priceRows.filter(r=>Number(r.vendor_count||0)>1).map(r=>[r.item||'Item',`${r.best_vendor||'Best vendor'} · ${r.comparison_basis||'unit'} · ${r.vendor_count} vendors`,appMoney2(r.best_price||0)]),total:['Matched Items',String(priceRows.filter(r=>Number(r.vendor_count||0)>1).length)]}]],
    'Invoice Lines': ['All memorized normalized invoice-line price records', [{title:'Invoice Lines',rows:(metrics.priceHistory||[]).map(r=>[r.item||'Item',`${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'} · ${r.date||'—'}`,appMoney2(r.unit_cost||r.case_price||0)]),total:['Invoice Lines',String((metrics.priceHistory||[]).length)]}]],
    'Sales Report': ['Sales activity for the selected period', [{title:'Sales Report',rows:salesRows,total:['Net Sales',appMoney(metrics.salesTotal)]},{title:'Payment Types',rows:paymentRows,total:['Payments',appMoney(metrics.salesTotal)]}]],
    'Payroll Report': ['Payroll activity for the selected period', [{title:'Payroll by Job Type',rows:jobGroups,total:['Payroll Total',appMoney(metrics.payrollTotal)]}]],
    'Expense Report': ['Operating expenses for the selected period', [{title:'Expense Categories',rows:expenseGroups,total:['Expense Total',appMoney(metrics.expenseTotal)]}]],
    'Period P&L': ['Period profit and loss using reconciled sales, COGS, labor and expenses', [{title:'Period P&L',rows:[['Net Sales',`${sales.length} sales days`,appMoney(metrics.salesTotal)],['COGS','Food + alcohol',appMoney(-metrics.cogs)],['Employer Labor','Tips excluded',appMoney(-(metrics.employerLabor||0))],['Operating Expenses',`${expenses.length} records`,appMoney(-metrics.expenseTotal)]],total:['Operating Profit',appMoney(metrics.operatingProfit)]}]],
    'Food Cost': ['Full allocated Food Department economics', [{title:'True Food Cost',rows:trueFoodRows,total:['True Food Cost',appMoney(dc.trueFoodCost ?? metrics.foodCost)]},{title:'Food Cost Rate',rows:[['Food Sales','Selected period',appMoney(dc.foodSales ?? metrics.foodSales)]],total:['Food Cost %',appPercent(dc.foodCostPercent ?? metrics.foodCostPercent)]}]],
    'True Food Cost': ['Full allocated Food Department economics', [{title:'True Food Cost',rows:trueFoodRows,total:['True Food Cost',appMoney(dc.trueFoodCost ?? metrics.foodCost)]}]],
    'Alcohol Cost': ['Full allocated Alcohol Department economics', [{title:'True Alcohol Cost',rows:trueAlcoholRows,total:['True Alcohol Cost',appMoney(dc.trueAlcoholCost ?? metrics.alcoholCost)]},{title:'Alcohol Cost Rate',rows:[['Alcohol Sales','Selected period',appMoney(dc.alcoholSales ?? metrics.alcoholSales)]],total:['Alcohol Cost %',appPercent(dc.alcoholCostPercent ?? metrics.alcoholCostPercent)]}]],
    'True Alcohol Cost': ['Full allocated Alcohol Department economics', [{title:'True Alcohol Cost',rows:trueAlcoholRows,total:['True Alcohol Cost',appMoney(dc.trueAlcoholCost ?? metrics.alcoholCost)]}]],
    'Food Profit': ['Food sales less fully allocated Food Department cost', [{title:'Food Profit Calculation',rows:[['Food Sales','Selected period department sales',appMoney(dc.foodSales??metrics.foodSales)],['True Food Cost','Direct purchases + BOH payroll + manager + allocated shared costs',appMoney(-(dc.trueFoodCost??metrics.foodCost))]],total:['Food Profit',appMoney(dc.foodProfit??((dc.foodSales||0)-(dc.trueFoodCost||0)))]}]],
    'Alcohol Profit': ['Alcohol sales less fully allocated Alcohol Department cost', [{title:'Alcohol Profit Calculation',rows:[['Alcohol Sales','Selected period department sales',appMoney(dc.alcoholSales??metrics.alcoholSales)],['True Alcohol Cost','Direct purchases + bar labor + manager + allocated shared costs',appMoney(-(dc.trueAlcoholCost??metrics.alcoholCost))]],total:['Alcohol Profit',appMoney(dc.alcoholProfit??((dc.alcoholSales||0)-(dc.trueAlcoholCost||0)))]}]],
    'Food Invoices': ['Food invoices in the selected period', [{title:'Food Invoices',rows:[['Food Purchases',`${metrics.foodInvoiceCount} invoices`,appMoney(metrics.foodCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Food Invoice Total',appMoney(metrics.foodCost)]}]],
    'Alcohol Invoices': ['Alcohol invoices in the selected period', [{title:'Alcohol Invoices',rows:[['Alcohol Purchases',`${metrics.alcoholInvoiceCount} invoices`,appMoney(metrics.alcoholCost)],['All Invoice Spend',`${invoices.length} invoices`,appMoney(metrics.invoiceTotal)]],total:['Alcohol Invoice Total',appMoney(metrics.alcoholCost)]}]],
    'Payroll Total': ['Payroll by job type, tips and payment methods', [{title:'Payroll by Job Type',rows:jobGroups,total:['Payroll Total',appMoney(metrics.payrollTotal)]},{title:'Payroll Classification',rows:[['Operating Labor',`${operatingRows.length} BOH/kitchen records`,appMoney(metrics.operatingLabor)],['Management Payroll',`${managementRows.length} allocated records`,appMoney(metrics.managementPayroll||0)],['Front of House Payroll',`${fohRows.length} excluded from Operating Labor`,appMoney(metrics.frontOfHousePayroll||0)],['Tip Pass-Through','EXCLUDED · employee-owned tips',appMoney(metrics.netTipsPaid)]],total:['Payroll Total',appMoney(metrics.payrollTotal)]},{title:'Payment Methods',rows:[['Cash Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='cash').length} entries`,appMoney(metrics.cashPayroll)],['Check Payroll',`${payroll.filter(r=>String(r.payment_method||r.method).toLowerCase()==='check').length} entries`,appMoney(metrics.checkPayroll)],['Total Hours','Imported and manual labor',metrics.payrollHours.toFixed(1)]],total:['Payroll Total',appMoney(metrics.payrollTotal)]}]],
    'Cash Payroll': ['Cash payment employees', [{title:'Cash Payroll',rows:[['Cash Payroll','Current records',appMoney(metrics.cashPayroll)]],total:['Cash Payroll',appMoney(metrics.cashPayroll)]}]],
    'Check Payroll': ['Check payment employees', [{title:'Check Payroll',rows:[['Check Payroll','Current records',appMoney(metrics.checkPayroll)]],total:['Check Payroll',appMoney(metrics.checkPayroll)]}]],
    'Total Hours': ['Payroll hours for the selected period', [{title:'Hours by Job Type',rows:Object.values(payroll.reduce((acc,row)=>{const label=String(row.job_type||row.job||'Unassigned');if(!acc[label])acc[label]={label,hours:0,count:0};acc[label].hours+=Number(row.hours||0)||0;acc[label].count+=1;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label)).map(g=>[g.label,`${g.count} payroll records`,`${g.hours.toFixed(1)} hrs`]),total:['Total Hours',`${Number(metrics.payrollHours||0).toFixed(1)} hrs`]}]],
    'Total Expenses': ['Operating expenses grouped by accounting category; payment method is shown separately', [{title:'Expense Categories',rows:expenseGroups,total:['Total Expenses',appMoney(metrics.expenseTotal)]},{title:'Payment Methods',rows:[['Cash Expenses','Cash payments',appMoney(metrics.cashExpenses)],['Check & ACH','Check / ACH payments',appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))],['Credit Expenses','Credit/card payments',appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]],total:['All Payment Methods',appMoney(metrics.expenseTotal)]}]],
    'Cash Expenses': ['Cash operating expenses in the selected period', [{title:'Cash Expenses',rows:[['Cash Expenses',`${expenses.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} matching records`,appMoney(metrics.cashExpenses)]],total:['Cash Expenses',appMoney(metrics.cashExpenses)]}]],
    'Check & ACH': ['Check and ACH operating expenses in the selected period', [{title:'Check & ACH',rows:[['Check & ACH',`${expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).length} matching records`,appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]],total:['Check & ACH',appMoney(expenses.filter(r=>['check','ach'].includes(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]}]],
    'Credit Expenses': ['Credit/card operating expenses in the selected period', [{title:'Credit Expenses',rows:[['Credit Expenses',`${expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).length} matching records`,appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]],total:['Credit Expenses',appMoney(expenses.filter(r=>/credit|card/.test(String(r.payment_type||r.method).toLowerCase())).reduce((sum,r)=>sum+(Number(r.amount||r.total||0)||0),0))]}]],
    'Cash Vendor Invoices': ['Cash-paid vendor invoices in the selected period', [{title:'Cash Vendor Invoices',rows:[['Cash Vendor Invoices',`${invoices.filter(r=>String(r.payment_type||r.method).toLowerCase()==='cash').length} matching invoices`,appMoney(metrics.cashInvoiceSpend)]],total:['Cash Vendor Invoices',appMoney(metrics.cashInvoiceSpend)]}]],
    'Total Employees': ['All employee profiles by labor classification', [{title:'Employees',rows:[['Kitchen / BOH',`${employees.filter(r=>payrollCostClass(r)==='operating-labor').length} employees`,String(employees.filter(r=>payrollCostClass(r)==='operating-labor').length)],['Front of House',`${employees.filter(r=>payrollCostClass(r)==='front-of-house').length} employees`,String(employees.filter(r=>payrollCostClass(r)==='front-of-house').length)],['Management',`${employees.filter(r=>payrollCostClass(r)==='management').length} employees`,String(employees.filter(r=>payrollCostClass(r)==='management').length)],['Excluded / Review',`${employees.filter(r=>payrollCostClass(r)==='review').length} employees`,String(employees.filter(r=>payrollCostClass(r)==='review').length)]],total:['Total Employees',String(employees.length)]}]],
    'Kitchen Staff': ['Kitchen / BOH employee profiles', [{title:'Kitchen / BOH',rows:employees.filter(r=>payrollCostClass(r)==='operating-labor').map(r=>[r.name||r.employee_name||'Employee',r.job||r.job_type||'Kitchen','BOH']),total:['Kitchen / BOH',String(employees.filter(r=>payrollCostClass(r)==='operating-labor').length)]}]],
    'Front of House': ['Waiter and Bartender employee profiles', [{title:'Front of House',rows:employees.filter(r=>payrollCostClass(r)==='front-of-house').map(r=>[r.name||r.employee_name||'Employee',r.job||r.job_type||'FOH','FOH']),total:['Front of House',String(employees.filter(r=>payrollCostClass(r)==='front-of-house').length)]}]],
    'Active Employees': ['Current employee records', [{title:'Employees',rows:[['Active Employees',`${employees.filter(r=>r.status!=='Inactive').length} active`,'Current'],['Total Employees',`${employees.length} records`,String(employees.length)]],total:['Employee Count',String(employees.length)]}]],
    'Total Payments': ['All check, ACH and bank-payment records for the selected period', [{title:'Bank & Check Payments',rows:[['Total Payments','Use Entries for exact transactions','Selected period']],total:['Status','Exact records attached by Bank & Checks']}]],
    'Cleared': ['Cleared bank/check payments for the selected period', [{title:'Cleared Payments',rows:[['Cleared','Use Entries for exact cleared transactions','Selected period']],total:['Status','Exact records attached by Bank & Checks']}]],
    'Pending': ['Pending bank/check payments for the selected period', [{title:'Pending Payments',rows:[['Pending','Use Entries for exact pending transactions','Selected period']],total:['Status','Exact records attached by Bank & Checks']}]],
    'Entries': ['Recorded bank/check transactions for the selected period', [{title:'Bank & Check Entries',rows:[['Entries','Use Entries for exact transactions','Selected period']],total:['Status','Exact records attached by Bank & Checks']}]],
    'Sales Imports': ['Sales import activity', [{title:'Sales Imports',rows:[['Sales files','Import Center sales uploads','Live import workflow']],total:['Source','Import Center']}]],
    'Labor Imports': ['Labor import activity', [{title:'Labor Imports',rows:[['Labor files','Import Center labor uploads','Live import workflow']],total:['Source','Import Center']}]],
    'Invoice Imports': ['Invoice import activity', [{title:'Invoice Imports',rows:[['Invoice files','AI/manual invoice uploads','Live import workflow']],total:['Source','Import Center']}]],
    'Completed': ['Completed import activity', [{title:'Completed Imports',rows:[['Completed','Successful reviewed imports','Import Center']],total:['Source','Import Center']}]],
    'Connection Status': ['Toast integration connection details', [{title:'Toast Connection',rows:[['Connection','Toast integration status','Connected']],total:['Status','Connected']}]],
    'Last Sales Sync': ['Most recent Toast sales synchronization', [{title:'Sales Sync',rows:[['Sales Sync','Most recent sales synchronization','See Toast jobs table']],total:['Source','Toast Integration']}]],
    'Last Labor Sync': ['Most recent Toast labor synchronization', [{title:'Labor Sync',rows:[['Labor Sync','Most recent labor synchronization','See Toast jobs table']],total:['Source','Toast Integration']}]],
    'Pending Jobs': ['Toast jobs waiting to process', [{title:'Pending Toast Jobs',rows:[['Pending Jobs','Waiting Toast jobs','See Toast jobs table']],total:['Source','Toast Integration']}]],
    'Restaurant Profile': ['Restaurant business identity and profile configuration', [{title:'Restaurant Profile',rows:[['Business Profile','Manage under Settings > Business','Settings']],total:['Action','Open Settings']}]],
    'Users & Roles': ['User access, roles and Admin security', [{title:'Users & Roles',rows:[['Admin / Manager','Manage permissions, PIN and approvals','Settings']],total:['Action','Open Users & Security']}]],
    'Data & Backup': ['Supabase connection and data-protection settings', [{title:'Data & Backup',rows:[['Supabase',metrics?.liveConnected===false?'Not configured':'Connected','Live data']],total:['Action','Open Settings']}]],
    'Notifications': ['Import, payroll and workflow notifications', [{title:'Notifications',rows:[['Notifications','Manage alert preferences','Enabled']],total:['Action','Open Settings']}]],
  }
  const normalizedTitle=String(title||'').trim().toLowerCase()
  const selected=Object.entries(map).find(([key])=>key.trim().toLowerCase()===normalizedTitle)?.[1]
  if (selected) return { tone, subtitle:selected[0], sections:selected[1] }
  if (Array.isArray(explicitEntries) && explicitEntries.length) {
    const sample = explicitEntries[0] || {}
    if ('normalized_unit_cost' in sample || 'effective_each_cost' in sample || 'best_vendor' in sample || 'current_price' in sample) {
      const vendorGroups = Object.values(explicitEntries.reduce((acc,row)=>{const label=String(row.vendor||row.best_vendor||'Vendor');const key=label.toLowerCase();if(!acc[key])acc[key]={label,count:0,total:0};acc[key].count+=1;acc[key].total+=Number(row.unit_cost||row.normalized_unit_cost||row.effective_each_cost||row.current_price||row.best_price||0)||0;return acc},{})).sort((a,b)=>a.label.localeCompare(b.label))
      const latest=[...explicitEntries].sort((a,b)=>String(b.date||b.current_date||'').localeCompare(String(a.date||a.current_date||'')))[0]||{}
      const best=[...explicitEntries].filter(r=>Number(r.unit_cost||r.normalized_unit_cost||r.effective_each_cost||r.best_price||0)>0).sort((a,b)=>Number(a.unit_cost||a.normalized_unit_cost||a.effective_each_cost||a.best_price)-Number(b.unit_cost||b.normalized_unit_cost||b.effective_each_cost||b.best_price))[0]||{}
      return {tone:'green',subtitle:'Vendor price intelligence and normalized invoice history',sections:[{title:'Item Price Summary',rows:[['Latest Vendor',`${latest.date||latest.current_date||'Selected period'} · ${latest.comparison_basis||latest.purchase_unit||'unit'}`,latest.vendor||'—'],['Latest Normalized Cost',latest.package_size||'Comparable quantity',appMoney2(latest.unit_cost||latest.normalized_unit_cost||latest.effective_each_cost||latest.current_price||0)],['Best Known Vendor',best.date||best.current_date||'Historical price',best.vendor||best.best_vendor||'—'],['Best Normalized Cost',best.package_size||'Comparable quantity',appMoney2(best.unit_cost||best.normalized_unit_cost||best.effective_each_cost||best.best_price||0)]],total:['Price History Records',String(explicitEntries.length)]},{title:'By Vendor',rows:vendorGroups.map(g=>[g.label,`${g.count} price record${g.count===1?'':'s'}`,appMoney2(g.total/Math.max(1,g.count))]),total:['Vendors',String(vendorGroups.length)]}]}
    }
  }
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
    if (kind === 'bank') return [r.payment_date || r.date || '—', `${r.payee || 'Payee'} · ${r.type || 'Payment'} · ${r.reference || 'No reference'} · ${r.status || 'Pending'}`, appMoney2(r.amount || 0)]
    if (kind === 'vendor-intelligence') return [r.current_date || r.date || '—', `${r.item || 'Item'} · current ${r.vendor || 'Vendor'} → best ${r.best_vendor || r.vendor || 'Vendor'} · ${r.comparison_basis || r.normalized_unit || 'unit'}`, appMoney2(r.potential_savings ?? r.savings ?? r.best_price ?? r.current_price ?? 0)]
    return [r.business_date || r.date || '—', `${r.category || r.department || 'Sales'} · ${r.source || 'Toast POS'}`, appMoney2(r.net_sales ?? r.amount ?? r.sales ?? 0)]
  })
}

function buildRecentEntries(title, collections, explicitEntries = []) {
  const metrics = collections.metrics || {}
  const dc = metrics.departmentCosts || {}
  const payrollSummary = metrics.payrollSummary || {}
  const scopeParts = String(title || '').split(' > ')
  const parentTitle = scopeParts.length > 1 ? scopeParts[0] : ''
  const scopeLabel = scopeParts.length > 1 ? scopeParts.slice(1).join(' > ') : String(title || '')
  if (Array.isArray(explicitEntries) && explicitEntries.length) {
    const sample = explicitEntries[0] || {}
    const kind = ('employee_name' in sample || 'regular_pay' in sample || 'base_pay' in sample) ? 'payroll'
      : ('invoice_number' in sample || 'invoice_date' in sample || 'line_total' in sample || 'purchase_unit' in sample || 'normalized_unit_cost' in sample) ? 'invoice'
      : ('payee' in sample || 'reference' in sample) ? 'bank'
      : ('best_vendor' in sample || 'current_price' in sample || 'potential_savings' in sample) ? 'vendor-intelligence'
      : ('expense_date' in sample || 'payment_type' in sample || 'expense_type' in sample) ? 'expense'
      : ('business_date' in sample || 'net_sales' in sample || 'cash_sales' in sample) ? 'sales'
      : ('vendor_type' in sample || 'website' in sample || 'logo_url' in sample) ? 'vendor' : 'sales'
    return entryTriples(explicitEntries, kind)
  }

  const label = String(scopeLabel || '').trim()
  const lowerLabel = label.toLowerCase()
  let rows = []
  let kind = 'sales'

  const employerPayrollAmount = row => Math.max(0, payrollEntryValue(row) - (Number(row.net_tips ?? row.tips_after_withholding ?? row.credit_card_tips ?? row.tips ?? 0) || 0))
  const costTriples = (costRows = [], labelPrefix = '') => costRows.map(r => {
    const amount = Number(r._display_amount ?? r.allocatedAmount ?? r.amount ?? r.line_total ?? r.total ?? 0) || 0
    const date = r.invoice_date || r.expense_date || r.pay_date || r.payroll_date || r.date || '—'
    const source = r._source_table === 'expenses' ? `${r.vendor || r.vendor_name || 'Vendor'} · ${r.expense_type || r.type || r.category || r.costLabel || 'Expense'}`
      : r.payrollLabel ? `${r.employee_name || r.employee || 'Employee'} · ${r.job_type || r.job || r.payrollLabel}`
      : `${r.vendor || r.vendor_name || 'Vendor'} · ${r.invoice_number || r.number || r.category || r.costLabel || 'Purchase'}`
    const allocation = r._allocation_percent !== undefined ? ` · ${r._allocation_percent}% allocation` : ''
    return [date, `${labelPrefix ? `${labelPrefix} · ` : ''}${source}${allocation}`, appMoney2(amount)]
  })
  const foodDirect = dc.spendDetails?.food || []
  const alcoholDirect = [...(dc.spendDetails?.beer || []), ...(dc.spendDetails?.liquor || []), ...(dc.spendDetails?.margaritaMix || [])]
  const foodShared = dc.spendDetails?.sharedFood || []
  const alcoholShared = dc.spendDetails?.sharedAlcohol || []
  const kitchenPayroll = dc.payrollDetails?.kitchen || []
  const barPayroll = dc.payrollDetails?.bar || []
  const managerPayroll = dc.payrollDetails?.manager || []
  const operatingPayroll = payrollSummary.operatingRows || collections.payroll.filter(r=>payrollCostClass(r)==='operating-labor')
  const managementPayroll = payrollSummary.managementRows || collections.payroll.filter(r=>payrollCostClass(r)==='management')
  const frontPayroll = payrollSummary.frontOfHouseRows || collections.payroll.filter(r=>payrollCostClass(r)==='front-of-house')
  const reviewPayroll = payrollSummary.reviewRows || collections.payroll.filter(r=>payrollCostClass(r)==='review')
  const allClassifiedPayroll = [...operatingPayroll,...managementPayroll,...frontPayroll,...reviewPayroll]

  if (/^(food cost|true food cost)$/i.test(label)) {
    const manager = managerPayroll.map(r=>({...r,_display_amount:Number(r.foodAllocated||0),_allocation_percent:dc.rules?.managerPayroll?.food ?? 0}))
    return [...costTriples(foodDirect,'Direct Food Purchase'), ...costTriples(kitchenPayroll.map(r=>({...r,_display_amount:Number(r.amount||0)})),'Kitchen Payroll'), ...costTriples(manager,'Manager'), ...costTriples(foodShared,'Allocated Shared Cost')].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  }
  if (/^(alcohol cost|true alcohol cost)$/i.test(label)) {
    const manager = managerPayroll.map(r=>({...r,_display_amount:Number(r.alcoholAllocated||0),_allocation_percent:dc.rules?.managerPayroll?.alcohol ?? 0}))
    return [...costTriples(alcoholDirect,'Direct Alcohol Purchase'), ...costTriples(barPayroll.map(r=>({...r,_display_amount:Number(r.amount||0)})),'Bar Payroll'), ...costTriples(manager,'Manager'), ...costTriples(alcoholShared,'Allocated Shared Cost')].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  }
  if (/^direct food purchases$/i.test(label)) return costTriples(foodDirect,'Direct Food Purchase')
  if (/^direct alcohol purchases$/i.test(label)) return costTriples(alcoholDirect,'Direct Alcohol Purchase')
  if (/^kitchen payroll$/i.test(label)) return costTriples(kitchenPayroll.map(r=>({...r,_display_amount:Number(r.amount||0)})),'Kitchen Payroll')
  if (/^bar payroll$/i.test(label)) return costTriples(barPayroll.map(r=>({...r,_display_amount:Number(r.amount||0)})),'Bar Payroll')
  if (/^supplies allocation$/i.test(label)) {
    const set = (parentTitle.toLowerCase().includes('alcohol') ? alcoholShared : foodShared).filter(r=>r.costRule==='supplies')
    const pct = parentTitle.toLowerCase().includes('alcohol') ? dc.rules?.supplies?.alcohol : dc.rules?.supplies?.food
    return costTriples(set.map(r=>({...r,_display_amount:Number(r.allocatedAmount||0),_allocation_percent:pct ?? 0})),'Supplies')
  }
  if (/^(shared costs|supplies \/ shared allocation)$/i.test(label)) {
    const isAlcohol = parentTitle.toLowerCase().includes('alcohol')
    const all = isAlcohol ? alcoholShared : foodShared
    const set = /^shared costs$/i.test(label) ? all.filter(r=>r.costRule!=='supplies') : all
    return costTriples(set.map(r=>({...r,_display_amount:Number(r.allocatedAmount||0)})),'Allocated Shared Cost')
  }
  if (/^(manager allocation|management allocation)$/i.test(label)) {
    const isAlcohol = parentTitle.toLowerCase().includes('alcohol')
    const pct = isAlcohol ? dc.rules?.managerPayroll?.alcohol : dc.rules?.managerPayroll?.food
    const set = managerPayroll.map(r=>({...r,_display_amount:Number(isAlcohol?r.alcoholAllocated:r.foodAllocated)||0,_allocation_percent:pct ?? 0}))
    return costTriples(set,'Manager Allocation')
  }
  if (/^prime cost$/i.test(label)) {
    const labor = [...operatingPayroll,...managementPayroll].map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0)
    return [...costTriples(foodDirect,'Direct Food Purchase'),...costTriples(alcoholDirect,'Direct Alcohol Purchase'),...entryTriples(labor,'payroll')].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  }
  if (/^operating labor$/i.test(label)) { rows = operatingPayroll.map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0); kind='payroll' }
  else if (/^management payroll$/i.test(label)) { rows = managementPayroll.map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0); kind='payroll' }
  else if (/^(front of house payroll|front of house wages)$/i.test(label)) { rows = frontPayroll.map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0); kind='payroll' }
  else if (/^unmapped payroll$/i.test(label)) { rows = reviewPayroll.map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0); kind='payroll' }
  else if (/^tip pass-through$/i.test(label)) { rows = allClassifiedPayroll.filter(r=>Number(r.net_tips??r.tips_after_withholding??r.credit_card_tips??r.tips??0)!==0).map(r=>({...r,_display_amount:Number(r.net_tips??r.tips_after_withholding??r.credit_card_tips??r.tips??0)||0})); kind='payroll' }
  else if (/^(profit summary|operating profit)$/i.test(label)) {
    const labor=[...operatingPayroll,...managementPayroll,...frontPayroll].map(r=>({...r,_display_amount:employerPayrollAmount(r)})).filter(r=>r._display_amount>0)
    return [...costTriples(foodDirect,'Food COGS'),...costTriples(alcoholDirect,'Alcohol COGS'),...entryTriples(labor,'payroll'),...entryTriples(collections.expenses,'expense')].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  }
  else if (/^cost of goods$/i.test(label)) return [...costTriples(foodDirect,'Food COGS'),...costTriples(alcoholDirect,'Alcohol COGS')].sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
  else if (/^operating expenses$/i.test(label)) { rows=collections.expenses; kind='expense' }
  else 
if (lowerLabel === 'cash expenses') { rows = collections.expenses.filter(r => expenseMethod(r) === 'cash'); kind = 'expense' }
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
  else if (/cash withdrawals?/i.test(label)) { rows = collections.expenses.filter(r=>/cash withdrawal|owner withdrawal|cash draw/i.test(`${r.category||''} ${r.type||''} ${r.name||''} ${r.payment_type||''}`)); kind='expense' }
  else if (/price increases?|items increased/i.test(label)) return (metrics.priceComparisons||[]).filter(r=>Number(r.change||0)>0).map(r=>[r.current_date||r.date||'—',`${r.item||'Item'} · ${r.vendor||'Vendor'}`,`${Number(r.change_percent||0).toFixed(1)}%`])
  else if (/items decreased/i.test(label)) return (metrics.priceComparisons||[]).filter(r=>Number(r.change||0)<0).map(r=>[r.current_date||r.date||'—',`${r.item||'Item'} · ${r.vendor||'Vendor'}`,`${Number(r.change_percent||0).toFixed(1)}%`])
  else if (/compared items/i.test(label)) return (metrics.priceComparisons||[]).map(r=>[r.current_date||r.date||'—',`${r.item||'Item'} · ${r.vendor||'Vendor'} · ${r.comparison_basis||'unit'}`,appMoney2(r.current_price||0)])
  else if (/best vendor matches/i.test(label)) return (metrics.priceComparisons||[]).filter(r=>Number(r.vendor_count||0)>1).map(r=>[r.current_date||r.date||'—',`${r.item||'Item'} · best ${r.best_vendor||'Vendor'} · ${r.comparison_basis||'unit'} · ${r.vendor_count||0} vendors`,appMoney2(r.best_price||0)])
  else if (/invoice lines/i.test(label)) return (metrics.priceHistory||[]).map(r=>[r.invoice_date||r.date||'—',`${r.item||'Item'} · ${r.vendor||'Vendor'} · ${r.comparison_basis||r.purchase_unit||'unit'}`,appMoney2(r.normalized_unit_cost||r.effective_each_cost||r.unit_cost||r.case_price||0)])
  else if (/unit impact|potential savings/i.test(label)) return (metrics.priceComparisons||[]).map(r=>[r.current_date||r.date||'—',`${r.item||'Item'} · ${r.best_vendor||r.vendor||'Vendor'}`,appMoney2(r.change||r.savings||r.potential_savings||0)])
  else if (lowerLabel === 'total hours') { return allClassifiedPayroll.map(r=>[r.pay_date||r.payroll_date||r.date||'—',`${r.employee_name||r.employee||'Employee'} · ${r.job_type||r.job||'Job'}`,`${Number(r.hours||r.regular_hours||0).toFixed(1)} hrs`]) }
  else if (lowerLabel === 'food sales' && (dc.foodDepartmentRows||dc.foodSalesRows)) { return (dc.foodDepartmentRows?.length?dc.foodDepartmentRows:dc.foodSalesRows||[]).map(r=>[r.business_date||r.date||'Selected period',`${r.category||r.normalizedCategory||r.toastDepartment||'Food Sales'}`,appMoney2(r.salesAmount??r.amount??r.net_sales??0)]) }
  else if (lowerLabel === 'alcohol sales' && (dc.alcoholDepartmentRows||dc.alcoholSalesRows)) { return (dc.alcoholDepartmentRows?.length?dc.alcoholDepartmentRows:dc.alcoholSalesRows||[]).map(r=>[r.business_date||r.date||'Selected period',`${r.category||r.normalizedCategory||r.toastDepartment||'Alcohol Sales'}`,appMoney2(r.salesAmount??r.amount??r.net_sales??0)]) }
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
    const invoiceLineMatches = collections.invoices.flatMap(inv=>(Array.isArray(inv.lines)&&inv.lines.length?inv.lines:[inv]).filter(line=>String(line.category||inv.category||'').trim().toLowerCase()===lowerLabel).map(line=>({...line,vendor:inv.vendor||inv.vendor_name,invoice_number:inv.invoice_number||inv.number,invoice_date:inv.invoice_date||inv.date})))
    const vendorCategoryMatches = collections.vendors.filter(r=>String(r.category||r.expenseType||r.expense_type||'').trim().toLowerCase()===lowerLabel)
    const expenseMatches = collections.expenses.filter(r => String(r.expense_type||r.type||r.category||'').trim().toLowerCase() === lowerLabel)
    const jobMatches = allClassifiedPayroll.filter(r => String(r.job_type||r.job||r.position||r.role||'').trim().toLowerCase() === lowerLabel)
    const vendorMatches = collections.invoices.filter(r => vendorName(r).toLowerCase() === lowerLabel)
    if (invoiceLineMatches.length) { rows = invoiceLineMatches; kind = 'invoice' }
    else if (vendorCategoryMatches.length) { rows = vendorCategoryMatches; kind = 'vendor' }
    else if (expenseMatches.length) { rows = expenseMatches; kind = 'expense' }
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
  'Compared Items':'/vendor-comparison','Best Vendor Matches':'/vendor-comparison','Best Savings':'/vendor-comparison','Matched Sizes':'/vendor-comparison','Potential Savings':'/vendor-comparison','Invoice Lines':'/vendor-comparison',
  'Price Increases':'/price-increase','Items Increased':'/price-increase','Average Increase':'/price-increase','Largest Increase':'/price-increase','Items Decreased':'/price-increase','Unit Impact':'/price-increase',
  'Total Employees':'/employees','Active Employees':'/employees','Kitchen Staff':'/employees','Front of House':'/employees','Weekly Base Pay':'/employees',
  'Payroll Total':'/payroll','Cash Payroll':'/payroll','Check Payroll':'/payroll','Total Hours':'/payroll',
  'Total Expenses':'/expenses','Cash Expenses':'/expenses','Check & ACH':'/expenses','Check / ACH':'/expenses','Credit Expenses':'/expenses',
  'Bank Activity':'/bank-checks','Total Payments':'/bank-checks','Cleared':'/bank-checks','Pending':'/bank-checks','Entries':'/bank-checks','Cleared Payments':'/bank-checks','Pending Payments':'/bank-checks','Checks Issued':'/bank-checks',
  'Sales Imports':'/import-center','Labor Imports':'/import-center','Invoice Imports':'/import-center','Completed':'/import-center',
  'Connection Status':'/toast-integration','Last Sales Sync':'/toast-integration','Last Labor Sync':'/toast-integration','Pending Jobs':'/toast-integration',
}

export default function DetailDrawer({ title, entries = [], initialTab = 'Overview', headerAction = null, onClose }) {
  const navigate = useNavigate()
  const { notify } = useFeedback()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [expanded, setExpanded] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const [entryScope, setEntryScope] = useState('')
  const [notes, setNotes] = useState('')
  const [withdrawal, setWithdrawal] = useState({date:new Date().toISOString().slice(0,10),amount:'',purpose:'',notes:''})
  const [savingWithdrawal, setSavingWithdrawal] = useState(false)
  const [editingCashId,setEditingCashId]=useState(null)
  const [balanceTarget,setBalanceTarget]=useState({date:new Date().toISOString().slice(0,10),amount:'203',reason:'Cash balance reconciliation'})
  const { range: globalRange } = useGlobalDateRange()
  const [drawerRange, setDrawerRange] = useState(() => readDateRange())
  const [draftRange, setDraftRange] = useState(() => readDateRange())
  const appData = useAppData(drawerRange)
  const { metrics, sales, invoices, expenses, payroll, vendors, employees, cashLedger=[] } = appData
  const content = useMemo(() => buildDrawerContent(title, appData, entries), [title, appData, entries])

  useEffect(() => {
    setActiveTab(initialTab); setExpanded(initialTab === 'Entries'); setSelectedRow(null); setEntryScope('')
    const activeRange = readDateRange()
    setDrawerRange(activeRange); setDraftRange(activeRange)
    if (title) setNotes(localStorage.getItem(`restapay.drawer.notes.${title}`) || '')
  }, [title, initialTab, globalRange.from, globalRange.to, globalRange.preset])

  const categoryRows = useMemo(() => {
    const preferred = ['Business Expenses','Total Expenses'].includes(title) ? ['Expense Categories'] : title === 'Payroll Total' ? ['Payroll by Job Type'] : []
    const sections = preferred.length ? content.sections.filter(section=>preferred.includes(section.title)) : content.sections
    return sections.flatMap((section) => section.rows.map((row) => ({ section: section.title, row })))
  }, [content, title])
  const scopedExplicitEntries = useMemo(() => (Array.isArray(entries)?entries:[]).filter(row=>inDateRange(row,drawerRange,['effective_date','current_date','previous_date','invoice_date','expense_date','pay_date','payroll_date','business_date','date'])), [entries,drawerRange])
  const recentEntries = useMemo(() => buildRecentEntries(entryScope || title, { sales, invoices, expenses, payroll, vendors, employees, metrics }, scopedExplicitEntries), [entryScope, title, scopedExplicitEntries, sales, invoices, expenses, payroll, vendors, employees, metrics])
  if (!title) return null

  const entryLabel = String(entryScope || '').includes(' > ') ? String(entryScope).split(' > ').slice(1).join(' > ') : (entryScope || title)
  const openWorkspace = () => { const target = routeMap[entryLabel] || routeMap[title] || '/dashboard'; onClose?.(); navigate(target) }
  const showMatchingEntries = (label) => { setSelectedRow(null); setEntryScope(label && label !== title ? `${title} > ${label}` : title); setActiveTab('Entries'); setExpanded(true) }
  const exportDrawer = () => {
    const csv = [['Section','Item','Details','Value'], ...categoryRows.map(({section,row}) => [section,...row])]
      .map((line) => line.map((value) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-details.csv`; anchor.click(); URL.revokeObjectURL(url)
    notify(`${title} details exported.`)
  }
  const saveNotes = () => { localStorage.setItem(`restapay.drawer.notes.${title}`, notes); notify(`${title} notes saved locally.`) }
  const saveCashWithdrawal = async () => {
    const amount = Number(withdrawal.amount||0)
    if (!withdrawal.date || amount <= 0 || !withdrawal.purpose.trim()) return notify('Enter withdrawal date, amount and purpose.', 'error')
    setSavingWithdrawal(true)
    const row = {id:editingCashId||crypto.randomUUID?.()||`cash-withdrawal-${Date.now()}`,date:withdrawal.date,entry_date:withdrawal.date,type:'withdrawal',entry_type:'withdrawal',amount:Math.abs(amount),purpose:withdrawal.purpose.trim(),notes:withdrawal.notes.trim(),created_at:new Date().toISOString()}
    try {
      await replaceLiveCollection('restapay-cash-ledger', current=>editingCashId?(current||[]).map(item=>item.id===editingCashId?{...item,...row,created_at:item.created_at||row.created_at}:item):[...(current||[]),row])
      setWithdrawal({date:new Date().toISOString().slice(0,10),amount:'',purpose:'',notes:''});setEditingCashId(null)
      notify(`Cash withdrawal ${appMoney2(amount)} ${editingCashId?'updated':'recorded'}.`)
    } catch (error) { notify(error.message||'Cash withdrawal could not be saved.','error') }
    finally { setSavingWithdrawal(false) }
  }
  const editCashEntry = row => {setEditingCashId(row.id);setWithdrawal({date:row.entry_date||row.date||new Date().toISOString().slice(0,10),amount:String(Math.abs(Number(row.amount||0))),purpose:row.purpose||'',notes:row.notes||''})}
  const deleteCashEntry = async row => {if(!confirm(`Delete cash withdrawal ${appMoney2(row.amount)}? Remaining Cash will be recalculated.`))return;try{await replaceLiveCollection('restapay-cash-ledger',current=>(current||[]).filter(item=>item.id!==row.id));notify('Cash withdrawal deleted.')}catch(error){notify(error.message||'Withdrawal could not be deleted.','error')}}
  const saveBalanceAdjustment = async () => {const target=Number(balanceTarget.amount);if(!balanceTarget.date||!Number.isFinite(target))return notify('Enter a valid adjustment date and target closing balance.','error');const delta=Number((target-Number(metrics.cashRemaining||0)).toFixed(2));const reason=(balanceTarget.reason||'Cash balance reconciliation').replace(/\s*\|\s*RESTAPAY_CLOSING_BALANCE=[-+]?\d+(?:\.\d+)?/ig,'').trim();const row={id:crypto.randomUUID?.()||`cash-adjustment-${Date.now()}`,date:balanceTarget.date,entry_date:balanceTarget.date,type:'adjustment',entry_type:'adjustment',amount:delta,target_closing_balance:target,purpose:'Set Closing Balance',notes:`${reason} | RESTAPAY_CLOSING_BALANCE=${target.toFixed(2)}`,created_at:new Date().toISOString()};try{await replaceLiveCollection('restapay-cash-ledger',current=>[...(current||[]),row]);notify(`Closing cash adjusted to ${appMoney2(target)} for the selected period.`)}catch(error){notify(error.message||'Cash balance adjustment could not be saved.','error')}}
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
      <header className="drawer-header"><div><h2>{title}</h2><p>{content.subtitle}</p></div><div className="drawer-header-actions">{headerAction}
        <button type="button" className="drawer-icon-button" aria-label={expanded ? 'Restore size' : 'Expand'} onClick={() => setExpanded((value) => !value)}>{expanded ? <Minimize2 size={18}/> : <Expand size={18}/>}</button>
        <button type="button" className="drawer-icon-button" aria-label="Close" onClick={onClose}><X size={20}/></button>
      </div></header>
      <div className="drawer-range drawer-range-controls">
        <div className="drawer-range-current"><span>Date Range</span><strong>{formatRangeDate(drawerRange.from)} — {formatRangeDate(drawerRange.to)}</strong></div>
        <div className="drawer-range-editor">
          <select aria-label="Detail date range preset" value={draftRange.preset || 'custom'} onChange={event => handleDrawerPreset(event.target.value)}>
            <option value="today">Today</option><option value="yesterday">Yesterday</option><option value="week">This Week</option><option value="last-week">Last Week</option><option value="month">This Month</option><option value="last-month">Last Month</option><option value="quarter">This Quarter</option><option value="last-quarter">Last Quarter</option><option value="year">This Year</option><option value="last-year">Last Year</option><option value="custom">Custom Range</option>
          </select>
          <input aria-label="Detail range from" type="date" value={draftRange.from || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',from:event.target.value})}/>
          <span className="drawer-range-separator">—</span>
          <input aria-label="Detail range to" type="date" value={draftRange.to || ''} onChange={event => setDraftRange({...draftRange,preset:'custom',to:event.target.value})}/>
          <button type="button" onClick={applyDrawerRange}>Apply</button>
        </div>
      </div>
      <nav className="drawer-tabs" aria-label="Detail sections">{['Overview','By Category','Entries','Notes'].map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} type="button" onClick={() => { setActiveTab(tab); setSelectedRow(null); if (tab !== 'Entries') setEntryScope('') }}>{tab}</button>)}</nav>

      <div className="drawer-scroll">
        {activeTab === 'Overview' && <>{content.sections.map((section) => <section className="drawer-section" key={section.title}><h3>{section.title}</h3>{section.rows.map(([label,meta,value]) => <button className={`drawer-row ${/tip pass-through/i.test(label) ? 'drawer-row-excluded' : ''}`} type="button" key={`${section.title}-${label}`} onClick={() => showMatchingEntries(label)}><span><strong>{label}</strong><small>{meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}<div className="drawer-total"><strong>{section.total[0]}</strong><b>{section.total[1]}</b></div></section>)}
          {/cash remaining|cash flow/i.test(title) && <><section className="drawer-section cash-withdrawal-section"><h3>{editingCashId?'Edit Cash Withdrawal':'Record Cash Withdrawal'}</h3><div className="cash-withdrawal-grid"><label>Date<input type="date" value={withdrawal.date} onChange={e=>setWithdrawal({...withdrawal,date:e.target.value})}/></label><label>Amount<input type="number" min="0" step="0.01" value={withdrawal.amount} onChange={e=>setWithdrawal({...withdrawal,amount:e.target.value})} placeholder="0.00"/></label><label>Purpose<input value={withdrawal.purpose} onChange={e=>setWithdrawal({...withdrawal,purpose:e.target.value})} placeholder="Owner draw, bank deposit, petty cash..."/></label><label>Notes<input value={withdrawal.notes} onChange={e=>setWithdrawal({...withdrawal,notes:e.target.value})} placeholder="Optional notes"/></label></div><div className="cash-ledger-actions"><button className="drawer-inline-action" type="button" disabled={savingWithdrawal} onClick={saveCashWithdrawal}>{savingWithdrawal?'Saving...':editingCashId?'Update Withdrawal':'Record Withdrawal'}</button>{editingCashId&&<button className="secondary-action" type="button" onClick={()=>{setEditingCashId(null);setWithdrawal({date:new Date().toISOString().slice(0,10),amount:'',purpose:'',notes:''})}}>Cancel</button>}</div></section><section className="drawer-section"><h3>Cash Withdrawal History</h3>{cashLedger.filter(row=>String(row.entry_type||row.type).toLowerCase()==='withdrawal').sort((a,b)=>String(a.entry_date||a.date).localeCompare(String(b.entry_date||b.date))).map(row=><div className="drawer-row cash-ledger-row" key={row.id}><span><strong>{row.entry_date||row.date}</strong><small>{row.purpose||'Cash Withdrawal'}{row.notes?` · ${row.notes}`:''}</small></span><b>-{appMoney2(Math.abs(Number(row.amount||0)))}</b><div className="cash-ledger-row-actions"><button type="button" aria-label="Edit withdrawal" onClick={()=>editCashEntry(row)}><Pencil size={15}/></button><button type="button" aria-label="Delete withdrawal" onClick={()=>deleteCashEntry(row)}><Trash2 size={15}/></button></div></div>)}{!cashLedger.some(row=>String(row.entry_type||row.type).toLowerCase()==='withdrawal')&&<div className="drawer-empty">No cash withdrawals recorded yet.</div>}</section><section className="drawer-section"><h3>Cash Balance Adjustment</h3><p className="drawer-help">Use only to reconcile physical cash. This does not create an operating expense.</p><div className="cash-withdrawal-grid"><label>Effective Date<input type="date" value={balanceTarget.date} onChange={e=>setBalanceTarget({...balanceTarget,date:e.target.value})}/></label><label>Set Closing Cash To<input type="number" step="0.01" value={balanceTarget.amount} onChange={e=>setBalanceTarget({...balanceTarget,amount:e.target.value})}/></label><label>Reason<input value={balanceTarget.reason} onChange={e=>setBalanceTarget({...balanceTarget,reason:e.target.value})}/></label></div><button className="drawer-inline-action" type="button" onClick={saveBalanceAdjustment}>Set Closing Balance</button></section></>}
          {selectedRow && <section className="drawer-section drawer-drilldown"><div className="drawer-section-heading"><h3>{selectedRow.label} Details</h3><button onClick={() => setSelectedRow(null)}>Close</button></div><div className="drawer-detail-grid"><div><small>Section</small><strong>{selectedRow.section}</strong></div><div><small>Current Value</small><strong>{selectedRow.value}</strong></div><div><small>Description</small><strong>{selectedRow.meta}</strong></div><div><small>Status</small><strong className="drawer-ready"><CheckCircle2 size={15}/>Ready</strong></div></div><button className="drawer-inline-action" onClick={openWorkspace}>Open related records<ChevronRight size={16}/></button></section>}
        </>}

        {activeTab === 'By Category' && <section className="drawer-section"><h3>Category Breakdown</h3>{categoryRows.map(({section,row:[label,meta,value]}) => <button className={`drawer-row ${/tip pass-through/i.test(label) ? 'drawer-row-excluded' : ''}`} type="button" key={`${section}-${label}`} onClick={() => showMatchingEntries(label)}><span><strong>{label}</strong><small>{section} · {meta}</small></span><b>{value}</b><ChevronRight size={17}/></button>)}</section>}

        {activeTab === 'Entries' && <section className="drawer-section"><div className="drawer-section-heading"><div><h3>{entryLabel} Entries</h3><small>{recentEntries.length} matching record{recentEntries.length === 1 ? '' : 's'} shown for the selected date range</small></div><button type="button" onClick={openWorkspace}>Open workspace</button></div>{recentEntries.length ? recentEntries.map(([date,meta,value], index) => <div className="drawer-row drawer-entry-row" key={`${date}-${meta}-${index}`}><span><strong>{date}</strong><small>{meta}</small></span><b>{value}</b></div>) : <div className="drawer-empty">No matching records for this total and date range.</div>}</section>}

        {activeTab === 'Notes' && <section className="drawer-section drawer-notes"><h3>Notes</h3><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={`Add notes for ${title}...`}/><button type="button" className="drawer-inline-action" onClick={saveNotes}><Save size={16}/>Save Notes</button></section>}
      </div>

      <footer className="drawer-footer"><button type="button" className="secondary-action" onClick={exportDrawer}><Download size={17}/>Export</button><button type="button" className="secondary-action" onClick={() => window.print()}><Printer size={17}/>Print</button><button type="button" className="drawer-primary" onClick={openWorkspace}>Open Workspace<ChevronRight size={18}/></button></footer>
    </aside>
  </div>
}
