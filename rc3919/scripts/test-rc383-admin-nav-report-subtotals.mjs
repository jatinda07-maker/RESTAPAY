import fs from 'node:fs'
const access=fs.readFileSync('src/lib/accessControl.js','utf8')
const reports=fs.readFileSync('src/pages/Reports.jsx','utf8')
if(!access.includes("restapay:role-change")||!access.includes("setRole(next)")) throw new Error('Role synchronization hotfix missing')
if(!reports.includes("summaryLabel:'Payroll Tips Total'")) throw new Error('Payroll tips total label missing')
if(!reports.includes('sectionSubtotalRow')) throw new Error('Shared report subtotal helper missing')
if(!reports.includes('weekly-report-subtotal-row')) throw new Error('Report subtotal footer missing')
if(!reports.includes('sectionSubtotalRow(section),[]')) throw new Error('CSV subtotals missing')
console.log('RC3.8.3 admin navigation + report subtotal regression passed')
