import React from 'react'
import { employees, vendors, invoices, expenses } from '../data/mockData'
import { Icon } from '../components/Icons'

const map = {
  sales: { title: 'Sales', desc: 'Import Toast summaries and review cash, credit, online orders, gift cards, tips, refunds, and total sales.', button: 'Import Sales', rows: [['Cash Sales','$18,742.15','Daily'],['Credit Sales','$21,450.60','Daily'],['Online Orders','$7,843.20','Daily'],['Gift Cards','$3,215.30','Daily']] },
  vendors: { title: 'Vendors', desc: 'Manage vendor records, categories, margins, invoices, and spending history.', button: 'Add Vendor', rows: vendors.map(v => [v, 'Active', 'Food / Beverage']) },
  invoices: { title: 'Invoices', desc: 'Upload PDF, image, Excel, or manual invoices. Smart extraction is Supabase/AI-ready.', button: 'Upload Invoice', rows: invoices.map(i => [i[0], i[2], i[3]]) },
  employees: { title: 'Employees', desc: 'Manage employees, job types, cash/check payroll status, and extra pay reasons.', button: 'Add', rows: employees.map((e,i) => [e, i % 2 ? 'Check Payroll' : 'Cash Payroll', i % 2 ? 'Server' : 'Kitchen']) },
  payroll: { title: 'Payroll', desc: 'Create weekly payroll groups, apply Toast payroll, deduct 3.5% server tips, and add extra pay.', button: 'Run Payroll', rows: [['Kitchen Weekly Group','$4,250.00','Cash'],['Server Payroll','$6,820.00','Check'],['Extra Pay','$0.00','Editable']] },
  expenses: { title: 'Expenses', desc: 'Track restaurant expenses, utilities, supplies, maintenance, insurance, and cash expenses.', button: 'Add Expense', rows: expenses.map(e => [e[0], e[2], e[1]]) },
  reports: { title: 'Reports', desc: 'Standard and custom reports with date ranges, sorting, movable columns, and exports.', button: 'Build Report', rows: [['Profit & Loss','Ready','Monthly'],['Food Cost','Ready','Weekly'],['Labor Cost','Ready','Weekly'],['Vendor Spending','Ready','Custom']] },
  'price-increase': { title: 'Price Increase', desc: 'Compare invoice item prices by unit, not whole invoice totals, and flag margin impact.', button: 'Review Alerts', rows: [['Beef Ribeye','Unit price +8.1%','Food'],['Chicken Case','Unit price +3.4%','Food'],['Beer Keg','Unit price +2.9%','Beer']] },
  settings: { title: 'Settings', desc: 'Configure categories, employee job types, margins, Supabase, restaurant profile, and imports.', button: 'Save Settings', rows: [['Supabase','Not connected','Environment'],['Food Margin','30%','Category'],['Liquor Margin','70%','Category']] }
}
export default function EntityPage({ page }) {
  const cfg = map[page] || map.sales
  return <>
    <div className="page-head"><div><h1>{cfg.title}</h1><p>{cfg.desc}</p></div><div className="actions"><button className="btn primary"><Icon name="plus" /> {cfg.button}</button><button className="btn secondary">Clear</button></div></div>
    <div className="workspace-grid">
      <section className="form-card"><h2>{cfg.title} Workspace</h2><div className="form-grid"><input placeholder="Search or name" /><input placeholder="Category / type" /><input placeholder="Amount / value" /><input type="date" /></div><div className="actions left"><button className="btn primary">Save</button><button className="btn danger">Delete</button></div></section>
      <section className="table-card"><header><h2>{cfg.title} List</h2><span>Sorted A–Z</span></header><table><thead><tr><th>Name</th><th>Value</th><th>Status</th><th></th></tr></thead><tbody>{cfg.rows.map((r,i)=><tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><button>Edit</button></td></tr>)}</tbody></table></section>
    </div>
  </>
}
