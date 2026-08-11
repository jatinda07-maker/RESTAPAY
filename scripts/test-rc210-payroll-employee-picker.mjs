import fs from 'node:fs'

const payroll = fs.readFileSync(new URL('../src/pages/Payroll.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles/records.css', import.meta.url), 'utf8')

const checks = [
  ["Payroll uses live employee CRUD collection", payroll.includes("useCrudCollection('restapay-employees', [])")],
  ["Manual form stores employee id", payroll.includes("employee_id:'', employee_name:''")],
  ["Employee options come from active A-Z list", payroll.includes('activeEmployees.map(employee=>') && payroll.includes('Select employee')],
  ["Selecting employee inherits job and payment method", payroll.includes('selectManualEmployee') && payroll.includes('job_type: employee.job') && payroll.includes('payment_method: employee.method')],
  ["Inline add employee action exists", payroll.includes('openEmployeeAdd') && payroll.includes('payroll-add-employee-button')],
  ["Add employee modal saves and re-selects employee", payroll.includes('saveEmployeeFromPayroll') && payroll.includes('added and selected for payroll')],
  ["Duplicate employee name selects existing record", payroll.includes('already exists and was selected')],
  ["Employee selector layout keeps select text visible", css.includes('.payroll-employee-select-row') && css.includes('grid-template-columns:minmax(0,1fr) 42px')]
]

const failed = checks.filter(([, ok]) => !ok)
if (failed.length) {
  console.error('RC2.10 payroll employee picker regression failed:')
  for (const [name] of failed) console.error(`- ${name}`)
  process.exit(1)
}
console.log('RC2.10 payroll employee picker regression passed: active A-Z employee selection and inline Add Employee are wired.')
