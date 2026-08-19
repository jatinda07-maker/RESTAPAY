import { useMemo, useState } from 'react'
import { ArrowRight, Search, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppData, appMoney2 } from '../hooks/useAppData'

const txt = value => String(value ?? '').toLowerCase()
const words = query => txt(query).split(/[^a-z0-9]+/).filter(word => word.length > 1 && !['show','find','me','the','for','from','what','is','are','my','a','an'].includes(word))
const matches = (record, terms) => terms.every(term => txt(JSON.stringify(record)).includes(term))

export default function RestaAssistant(){
  const [open,setOpen]=useState(false), [query,setQuery]=useState('')
  const navigate=useNavigate(); const data=useAppData();
  const results=useMemo(()=>{
    const terms=words(query); if(!terms.length)return []
    const groups=[
      ['Invoices','/invoices',data.invoices,row=>`${row.vendor||row.vendor_name||'Invoice'} · ${row.invoice_number||row.number||''} · ${appMoney2(row.total||row.amount)}`],
      ['Payroll','/payroll',data.payroll,row=>`${row.employee_name||row.employee||'Payroll'} · ${row.payroll_date||row.pay_date||''} · ${appMoney2(row.total||row.total_pay||row.final_pay)}`],
      ['Expenses','/expenses',data.expenses,row=>`${row.vendor||row.name||row.category||'Expense'} · ${appMoney2(row.amount||row.total)}`],
      ['Vendors','/vendors',data.vendors,row=>`${row.name||'Vendor'} · ${row.category||row.vendor_type||''}`],
      ['Employees','/employees',data.employees,row=>`${row.name||row.employee_name||'Employee'} · ${row.job||row.job_type||''}`],
    ]
    return groups.flatMap(([type,path,rows,label])=>(rows||[]).filter(row=>matches(row,terms)).slice(0,5).map(row=>({type,path,label:label(row),id:row.id}))).slice(0,12)
  },[query,data.invoices,data.payroll,data.expenses,data.vendors,data.employees])
  return <><button className="resta-assistant-fab" onClick={()=>setOpen(true)} title="Resta AI Assistant"><Sparkles size={20}/><span>Ask Resta</span></button>{open&&<aside className="resta-assistant-panel"><header><div><Sparkles size={20}/><span><strong>Resta AI Assistant</strong><small>Search your live RESTAPAY records</small></span></div><button onClick={()=>setOpen(false)}><X size={19}/></button></header><label className="resta-assistant-search"><Search size={17}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try: Tommy payroll, US Foods invoice, avocado..."/></label>{!query?<div className="resta-assistant-empty"><strong>Ask for anything in RESTAPAY</strong><p>Start with an employee, vendor, invoice item, expense, or payroll record. Results come from your stored data.</p></div>:results.length?<div className="resta-assistant-results">{results.map((result,index)=><button key={`${result.type}-${result.id||index}`} onClick={()=>{navigate(result.path);setOpen(false)}}><span><small>{result.type}</small><strong>{result.label}</strong></span><ArrowRight size={16}/></button>)}</div>:<div className="resta-assistant-empty"><strong>No matching RESTAPAY records</strong><p>Try fewer words or search by employee, vendor, item, or date.</p></div>}<footer>Foundation mode: search and navigation only. It does not change records.</footer></aside>}</>
}
