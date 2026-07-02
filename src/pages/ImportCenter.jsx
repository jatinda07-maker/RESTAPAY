import React from 'react'
import { Icon } from '../components/Icons'

function money(value) { return Number(value || 0).toLocaleString(undefined, { style:'currency', currency:'USD' }) }

export default function ImportCenter({ data, setActive }) {
  const imports = data.bankImports || []
  const rules = data.bankPayeeRules || []
  const pending = (data.aiCheckDrafts || []).filter(r => r.status !== 'Imported')
  const lastImport = imports[0]
  const cards = [
    { key:'bank-statements', title:'AI Check Processing', icon:'sparkles', text:'Upload statements, extract checks, review, approve, and import selected payments.', tag:'Ready' },
    { key:'sales', title:'Toast Sales', icon:'barChart', text:'Import Toast sales summaries and update dashboard cash/credit totals.', tag:'Existing' },
    { key:'payroll', title:'Toast Payroll', icon:'wallet', text:'Import labor, tips, hours, and check/cash payroll records.', tag:'Existing' },
    { key:'invoices', title:'Vendor Invoice AI', icon:'fileText', text:'Upload invoices, review line items, vendors, categories, and price changes.', tag:'Existing' },
    { key:'ai-rules', title:'Rules Manager', icon:'bookOpen', text:'Review and edit what RestaPay has learned about vendors, employees, and categories.', tag:'New' }
  ]

  return <>
    <section className="ai-hero card">
      <div>
        <span className="eyebrow">RestaPay AI</span>
        <h2>AI Import Center</h2>
        <p>One review-first workspace for Toast files, vendor invoices, bank statements, checks, and learned category rules.</p>
      </div>
      <div className="ai-hero-stats">
        <div><b>{pending.length}</b><span>checks waiting</span></div>
        <div><b>{rules.length}</b><span>learned rules</span></div>
        <div><b>{imports.length}</b><span>bank imports</span></div>
      </div>
    </section>

    <section className="ai-grid">
      {cards.map(card => <button key={card.key} className="ai-import-card card" onClick={() => setActive(card.key)}>
        <span className="ai-import-icon"><Icon name={card.icon} size={22} /></span>
        <div>
          <strong>{card.title}</strong>
          <p>{card.text}</p>
          <small>{card.tag}</small>
        </div>
      </button>)}
    </section>

    <section className="card ai-workflow-card">
      <header><h2>Privacy-first import workflow</h2></header>
      <div className="workflow-steps">
        <div><b>1</b><span>Upload file</span></div>
        <div><b>2</b><span>Extract useful fields only</span></div>
        <div><b>3</b><span>Discard bank-sensitive details</span></div>
        <div><b>4</b><span>Review and approve</span></div>
        <div><b>5</b><span>Save selected records</span></div>
      </div>
      <p className="privacy-note">RestaPay saves only approved bookkeeping data such as date, check number, payee, amount, category, vendor/employee match, and payment method. It does not store account numbers, routing numbers, MICR lines, balances, signatures, or original check images unless you later enable document archiving.</p>
    </section>

    <section className="table-card compact-table-card">
      <header className="table-header-actions"><h2>Recent Imports</h2><button className="btn ghost" onClick={() => setActive('bank-statements')}>Open Check Processing</button></header>
      <div className="table-scroll"><table className="sales-table"><thead><tr><th>Date</th><th>Bank</th><th>Rows</th><th>Total</th></tr></thead><tbody>
        {imports.slice(0, 8).map(row => <tr key={row.id}><td>{row.date}</td><td>{row.bank || 'Bank Statement'}</td><td>{row.rows}</td><td>{money(row.total)}</td></tr>)}
        {!imports.length && <tr><td colSpan="4"><small>No imports yet. Start with AI Check Processing.</small></td></tr>}
      </tbody></table></div>
    </section>
  </>
}
