import React, { useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { createId } from '../lib/localStore'

function normalize(value) { return String(value || '').trim() }

export default function RulesManager({ data, setData }) {
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState({ payee:'', category:'Food', vendor:'', employee:'', type:'Vendor' })
  const categories = Array.from(new Set([...(data.vendorCategories || []), ...(data.expenseCategories || []), 'Food', 'Beverage', 'Beer', 'Liquor', 'Utilities', 'Payroll', 'Taxes', 'Loans', 'Merchant Fees', 'Supplies', 'Needs Review'])).filter(Boolean)
  const rules = data.bankPayeeRules || []
  const visible = useMemo(() => rules.filter(r => !search || `${r.payee} ${r.category} ${r.vendor} ${r.employee}`.toLowerCase().includes(search.toLowerCase())), [rules, search])

  function saveRule() {
    if (!normalize(draft.payee)) return
    setData(prev => {
      const list = [...(prev.bankPayeeRules || [])]
      const idx = list.findIndex(r => r.id === draft.id || r.payee?.toLowerCase() === draft.payee.toLowerCase())
      const row = { ...draft, id: draft.id || createId('rule'), updated_at: new Date().toISOString() }
      if (idx >= 0) list[idx] = row
      else list.unshift(row)
      return { ...prev, bankPayeeRules: list }
    })
    setDraft({ payee:'', category:'Food', vendor:'', employee:'', type:'Vendor' })
  }

  function editRule(rule) { setDraft({ type:'Vendor', ...rule }) }
  function deleteRule(id) { setData(prev => ({ ...prev, bankPayeeRules: (prev.bankPayeeRules || []).filter(r => r.id !== id) })) }

  return <>
    <section className="ai-hero card compact-ai-hero">
      <div><span className="eyebrow">AI Memory</span><h2>Rules Manager</h2><p>Edit the payee rules RestaPay uses to auto-categorize checks, vendors, employees, and expenses.</p></div>
      <div className="ai-hero-stats"><div><b>{rules.length}</b><span>total rules</span></div><div><b>{visible.length}</b><span>visible</span></div></div>
    </section>

    <section className="card rule-editor-card">
      <header><h2>{draft.id ? 'Edit Rule' : 'Add Rule'}</h2></header>
      <div className="rule-editor-grid">
        <label><span>Payee Pattern</span><input value={draft.payee} onChange={e => setDraft(d => ({ ...d, payee:e.target.value }))} placeholder="US Foods, Cintas, John Smith..." /></label>
        <label><span>Type</span><select value={draft.type || 'Vendor'} onChange={e => setDraft(d => ({ ...d, type:e.target.value }))}><option>Vendor</option><option>Employee</option><option>Expense</option></select></label>
        <label><span>Default Category</span><select value={draft.category} onChange={e => setDraft(d => ({ ...d, category:e.target.value }))}>{categories.map(cat => <option key={cat}>{cat}</option>)}</select></label>
        <label><span>Vendor Match</span><input value={draft.vendor || ''} onChange={e => setDraft(d => ({ ...d, vendor:e.target.value }))} placeholder="Optional vendor" /></label>
        <label><span>Employee Match</span><input value={draft.employee || ''} onChange={e => setDraft(d => ({ ...d, employee:e.target.value }))} placeholder="Optional employee" /></label>
        <div className="rule-actions"><button className="btn primary" onClick={saveRule}><Icon name="save" /> Save Rule</button><button className="btn ghost" onClick={() => setDraft({ payee:'', category:'Food', vendor:'', employee:'', type:'Vendor' })}>Clear</button></div>
      </div>
    </section>

    <section className="table-card compact-table-card">
      <header className="table-header-actions"><h2>Learned Rules <span className="inline-count">{visible.length}</span></h2><div className="inline-filter"><Icon name="search" size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rules..." /></div></header>
      <div className="table-scroll"><table className="sales-table"><thead><tr><th>Payee Pattern</th><th>Type</th><th>Category</th><th>Vendor</th><th>Employee</th><th>Updated</th><th>Actions</th></tr></thead><tbody>
        {visible.map(rule => <tr key={rule.id}><td><b>{rule.payee}</b></td><td>{rule.type || (rule.employee ? 'Employee' : 'Vendor')}</td><td><span className="tag green">{rule.category}</span></td><td>{rule.vendor || '—'}</td><td>{rule.employee || '—'}</td><td><small>{rule.updated_at ? new Date(rule.updated_at).toLocaleDateString() : '—'}</small></td><td><div className="row-actions"><button className="btn tiny ghost" onClick={() => editRule(rule)}>Edit</button><button className="btn tiny danger" onClick={() => deleteRule(rule.id)}>Delete</button></div></td></tr>)}
        {!visible.length && <tr><td colSpan="7"><small>No rules found.</small></td></tr>}
      </tbody></table></div>
    </section>
  </>
}
