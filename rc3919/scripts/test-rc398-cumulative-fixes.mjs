import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildHistoricalPayrollRepair, isWeeklyPayrollRecord } from '../src/core/engines/WeeklyPayrollEngine.js'
import { filterPayrollRows } from '../src/core/engines/PayrollFilterEngine.js'
import { applyLearnedInvoiceCategories, propagateInvoiceCategories, reconcileInvoiceExtraction } from '../src/core/engines/InvoiceEngine.js'

assert.equal(isWeeklyPayrollRecord({source:'kitchen-weekly',weekly_rollup:false}),true)
const repair=buildHistoricalPayrollRepair([
 {id:'t1',employee_name:'TOMMY',job_type:'Busser',source:'kitchen-weekly',payroll_date:'2026-08-09',week_start:'2026-08-03',week_end:'2026-08-09',regular_pay:700,total:700,method:'Cash'},
 ...[1,2,3,4,5].map(i=>({id:`x${i}`,employee_name:'TOMMY',job_type:'Busser',source:'kitchen-weekly',payroll_date:'2026-08-09',week_start:'2026-08-03',week_end:'2026-08-09',regular_pay:25,total:25,method:'Cash'})),
],{start:'2026-08-03',end:'2026-08-09'})
assert.equal(repair.kitchenRows.length,1)
assert.equal(repair.kitchenRows[0].regular_pay,700)
assert.equal(repair.kitchenRows[0].extra_pay,25)
assert.equal(repair.kitchenRows[0].total,725)

const filtered=filterPayrollRows([{employee:'TOMMY',job:'Busser',method:'Cash'},{employee:'Haleigh',job:'Front House',method:'Check'}],{columns:{job:'FRONT'}})
assert.deepEqual(filtered.map(r=>r.employee),['Haleigh'])

const recon=reconcileInvoiceExtraction({lines:[{description:'x',quantity:1,line_total:3797.52}],printedSubtotal:3797.52,printedTotal:3787.08,tax:2.54,charges:9})
assert.equal(recon.product_total,3775.54)
assert.equal(recon.calculated_total,3787.08)
assert.equal(recon.needs_review,true)
assert.match(recon.mismatches.join(' '),/line items total 3797\.52/)

const invoices=[{id:'a',lines:[{description:'HASS AVOCADO 48CT',category:'Other'}]}]
const propagated=propagateInvoiceCategories(invoices,[{description:'Hass Avocado 48ct',category:'Food'}])
assert.equal(propagated.rows[0].lines[0].category,'Food')
const learned=applyLearnedInvoiceCategories([{description:'Hass Avocado 48ct',category:'Other'}],propagated.rows)
assert.equal(learned[0].category,'Food')

const payrollSource=fs.readFileSync('src/pages/Payroll.jsx','utf8')
assert.match(payrollSource,/isWeeklyPayrollRecord\(row\)/)
assert.match(payrollSource,/filterPayrollRows/)
const invoiceSource=fs.readFileSync('src/pages/Invoices.jsx','utf8')
assert.match(invoiceSource,/Learn corrected item categories/)
assert.match(invoiceSource,/Printed Product Total<input/)
assert.equal(fs.existsSync('src/components/RestaAssistant.jsx'),true)
console.log('RC3.9.8 cumulative payroll/invoice/category/assistant regression passed')
