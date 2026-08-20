import { useState } from 'react'
import { Bell, Building2, ChevronRight, Database, Palette, Save, ShieldCheck, Sparkles, Users } from 'lucide-react'
import DetailDrawer from '../components/DetailDrawer'
import Modal from '../components/Modal'
import { useFeedback } from '../components/AppFeedback'
import { isSupabaseReady, supabase } from '../lib/supabase'
import usePersistentState from '../hooks/usePersistentState'
import useCrudCollection from '../hooks/useCrudCollection'
import {DEFAULT_CATEGORIES,DEFAULT_EXPENSE_TYPES,alphaSort,normalizeClassificationList,sameClassification} from '../lib/classifications'
import { DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

const cards=[
  {title:'Restaurant Profile',value:'Isabella Restaurant',meta:'Business identity',tone:'blue',icon:Building2},
  {title:'Users & Roles',value:'3 users',meta:'Access control',tone:'purple',icon:Users},
  {title:'Data & Backup',value:isSupabaseReady?'Connected':'Not configured',meta:'Live Supabase connection',tone:'green',icon:Database},
  {title:'Notifications',value:'Enabled',meta:'Imports and payroll alerts',tone:'orange',icon:Bell},
]
export default function Settings(){
  const[drawer,setDrawer]=useState(null),[tab,setTab]=useState('Business'),[roleEditor,setRoleEditor]=useState(null),[securityForm,setSecurityForm]=useState({email:'',password:'',confirm:''}),[geminiStatus,setGeminiStatus]=useState('Not tested'),[testingGemini,setTestingGemini]=useState(false);const {notify}=useFeedback()
  const [costSettings,setCostSettings]=usePersistentState('restapay-cost-settings',{departmentAllocations:DEFAULT_ALLOCATION_RULES})
  const [expenseTypes,setExpenseTypes]=usePersistentState('restapay-expense-types-v2',normalizeClassificationList([],DEFAULT_EXPENSE_TYPES))
  const [categories,setCategories]=usePersistentState('restapay-categories',normalizeClassificationList([],DEFAULT_CATEGORIES))
  const [vendors,,setVendors]=useCrudCollection('restapay-vendors',[])
  const [expenses,,setExpenses]=useCrudCollection('restapay-expenses',[])
  const [invoices,,setInvoices]=useCrudCollection('restapay-invoices',[])
  const allocations={...DEFAULT_ALLOCATION_RULES,...(costSettings?.departmentAllocations||{})}
  const setAllocation=(key,field,value)=>{const n=Math.max(0,Math.min(100,Number(value)||0));const other=field==='food'?'alcohol':'food';setCostSettings(prev=>({...prev,departmentAllocations:{...DEFAULT_ALLOCATION_RULES,...(prev?.departmentAllocations||{}),[key]:{...(prev?.departmentAllocations?.[key]||DEFAULT_ALLOCATION_RULES[key]),[field]:n,[other]:100-n}}}))}
  const classificationUsage=(kind,name)=>{
    if(kind==='expense') return {
      vendors:(vendors||[]).filter(row=>sameClassification(row.expenseType||row.expense_type,name)).length,
      expenses:(expenses||[]).filter(row=>sameClassification(row.type||row.expense_type,name)).length,
      invoices:0
    }
    return {
      vendors:(vendors||[]).filter(row=>sameClassification(row.category,name)).length,
      expenses:(expenses||[]).filter(row=>sameClassification(row.category,name)).length,
      invoices:(invoices||[]).filter(row=>sameClassification(row.category,name)||(row.lines||[]).some(line=>sameClassification(line.category,name))).length
    }
  }
  const usageText=usage=>`${usage.vendors} vendors, ${usage.expenses} expenses, ${usage.invoices} invoices`
  const addClassification=(kind)=>{const label=kind==='expense'?'Expense Type':'Category';const value=prompt(`Add ${label}`)?.trim();if(!value)return;const current=kind==='expense'?expenseTypes:categories;const defaults=kind==='expense'?DEFAULT_EXPENSE_TYPES:DEFAULT_CATEGORIES;if(normalizeClassificationList(current,defaults).some(item=>sameClassification(item.name,value)))return notify(`${label} already exists.`,'info');const next=normalizeClassificationList([...(current||[]),{name:value,active:true}],defaults);(kind==='expense'?setExpenseTypes:setCategories)(next);notify(`${label} added.`)}
  const renameClassification=async(kind,item)=>{const label=kind==='expense'?'Expense Type':'Category';const value=prompt(`Rename ${label} "${item.name}" to:`,item.name)?.trim();if(!value||sameClassification(value,item.name))return;const current=kind==='expense'?expenseTypes:categories;const defaults=kind==='expense'?DEFAULT_EXPENSE_TYPES:DEFAULT_CATEGORIES;if(normalizeClassificationList(current,defaults).some(existing=>!sameClassification(existing.name,item.name)&&sameClassification(existing.name,value)))return notify(`${label} "${value}" already exists. Use Merge instead.`,'error');const usage=classificationUsage(kind,item.name);if(!confirm(`WARNING: ${item.name} is used by ${usageText(usage)}. Renaming it to "${value}" will update linked records. Continue?`))return;if(kind==='expense'){
      await setVendors(rows=>(rows||[]).map(row=>sameClassification(row.expenseType||row.expense_type,item.name)?{...row,expenseType:value,expense_type:value}:row));
      await setExpenses(rows=>(rows||[]).map(row=>sameClassification(row.type||row.expense_type,item.name)?{...row,type:value,expense_type:value}:row));
      await setExpenseTypes(normalizeClassificationList([...(expenseTypes||[]).map(x=>sameClassification(x.name,item.name)?{...x,active:false}:x),{name:value,active:true}],defaults))
    }else{
      await setVendors(rows=>(rows||[]).map(row=>sameClassification(row.category,item.name)?{...row,category:value}:row));
      await setExpenses(rows=>(rows||[]).map(row=>sameClassification(row.category,item.name)?{...row,category:value}:row));
      await setInvoices(rows=>(rows||[]).map(row=>({...row,category:sameClassification(row.category,item.name)?value:row.category,lines:(row.lines||[]).map(line=>sameClassification(line.category,item.name)?{...line,category:value}:line)})));
      await setCategories(normalizeClassificationList([...(categories||[]).map(x=>sameClassification(x.name,item.name)?{...x,active:false}:x),{name:value,active:true}],defaults))
    }notify(`${label} renamed and linked records updated.`)}
  const toggleClassification=async(kind,item)=>{const label=kind==='expense'?'Expense Type':'Category';const usage=classificationUsage(kind,item.name);if(item.active!==false&&!confirm(`WARNING: Deactivating ${item.name} will hide it from new-entry selectors. Existing records (${usageText(usage)}) will keep the value. Continue?`))return;const defaults=kind==='expense'?DEFAULT_EXPENSE_TYPES:DEFAULT_CATEGORIES;const current=kind==='expense'?expenseTypes:categories;const next=normalizeClassificationList((current||[]).map(x=>sameClassification(x.name,item.name)?{...x,active:item.active===false}:x),defaults);await (kind==='expense'?setExpenseTypes:setCategories)(next);notify(`${label} ${item.active===false?'activated':'deactivated'}.`)}
  const mergeClassification=async(kind,item)=>{const label=kind==='expense'?'Expense Type':'Category';const current=normalizeClassificationList(kind==='expense'?expenseTypes:categories,kind==='expense'?DEFAULT_EXPENSE_TYPES:DEFAULT_CATEGORIES);const targets=current.filter(x=>x.active!==false&&!sameClassification(x.name,item.name));const targetName=prompt(`Merge ${label} "${item.name}" into which existing ${label}?

${targets.map(x=>x.name).join(', ')}`)?.trim();const target=targets.find(x=>sameClassification(x.name,targetName));if(!target)return targetName&&notify(`Choose an existing ${label}.`,'error');const usage=classificationUsage(kind,item.name);if(!confirm(`WARNING: Merge "${item.name}" into "${target.name}"? This will update ${usageText(usage)} and deactivate the old value.`))return;if(kind==='expense'){
      await setVendors(rows=>(rows||[]).map(row=>sameClassification(row.expenseType||row.expense_type,item.name)?{...row,expenseType:target.name,expense_type:target.name}:row));
      await setExpenses(rows=>(rows||[]).map(row=>sameClassification(row.type||row.expense_type,item.name)?{...row,type:target.name,expense_type:target.name}:row));
      await setExpenseTypes(normalizeClassificationList((expenseTypes||[]).map(x=>sameClassification(x.name,item.name)?{...x,active:false}:x),DEFAULT_EXPENSE_TYPES))
    }else{
      await setVendors(rows=>(rows||[]).map(row=>sameClassification(row.category,item.name)?{...row,category:target.name}:row));
      await setExpenses(rows=>(rows||[]).map(row=>sameClassification(row.category,item.name)?{...row,category:target.name}:row));
      await setInvoices(rows=>(rows||[]).map(row=>({...row,category:sameClassification(row.category,item.name)?target.name:row.category,lines:(row.lines||[]).map(line=>sameClassification(line.category,item.name)?{...line,category:target.name}:line)})));
      await setCategories(normalizeClassificationList((categories||[]).map(x=>sameClassification(x.name,item.name)?{...x,active:false}:x),DEFAULT_CATEGORIES))
    }notify(`${label} merged into ${target.name}.`)}
  const classificationPanel=(kind)=>{const label=kind==='expense'?'Expense Types':'Categories';const items=normalizeClassificationList(kind==='expense'?expenseTypes:categories,kind==='expense'?DEFAULT_EXPENSE_TYPES:DEFAULT_CATEGORIES).sort((a,b)=>alphaSort(a.name,b.name));return <section className="classification-manager"><header><div><h3>{label}</h3><p>Shared source for Vendors, Expenses, Invoices and filters. Changes to used values require confirmation.</p></div><button className="primary-button" onClick={()=>addClassification(kind)}>Add {kind==='expense'?'Expense Type':'Category'}</button></header><div className="classification-list">{items.map(item=>{const usage=classificationUsage(kind,item.name);return <div className={`classification-row ${item.active===false?'is-inactive':''}`} key={item.name}><div><strong>{item.name}</strong><small>{usageText(usage)} · {item.active===false?'Inactive':'Active'}</small></div><div><button className="secondary-action" onClick={()=>renameClassification(kind,item)}>Rename</button><button className="secondary-action" onClick={()=>mergeClassification(kind,item)}>Merge</button><button className="secondary-action" onClick={()=>toggleClassification(kind,item)}>{item.active===false?'Activate':'Deactivate'}</button></div></div>})}</div></section>}

  const openRoleEditor=async(role)=>{
    let email=''
    if(role==='Administrator'){ const {data}=await supabase.auth.getUser(); email=data?.user?.email||'' }
    setSecurityForm({email,password:'',confirm:''});setRoleEditor(role)
  }
  const saveRoleSecurity=async()=>{
    if(securityForm.password && securityForm.password.length<8)return notify('Password must be at least 8 characters.','error')
    if(securityForm.password!==securityForm.confirm)return notify('Passwords do not match.','error')
    try{
      if(roleEditor==='Administrator'){
        const patch={}; if(securityForm.email)patch.email=securityForm.email;if(securityForm.password)patch.password=securityForm.password
        const {error}=await supabase.auth.updateUser(patch);if(error)throw error
      }else{
        if(!securityForm.email)return notify('Enter the Manager login email.','error')
        const {data,error}=await supabase.functions.invoke('admin-reset-password',{body:{email:securityForm.email,password:securityForm.password,role:'manager'}});if(error)throw error;if(!data?.ok)throw new Error(data?.message||'Manager security update failed.')
      }
      notify(`${roleEditor} security updated.`,'success');setRoleEditor(null)
    }catch(error){notify(error?.message||'Security update failed.','error')}
  }
  const testGemini=async()=>{if(!isSupabaseReady)return notify('Supabase is not configured.','error');setTestingGemini(true);try{const {data,error}=await supabase.functions.invoke('gemini-invoice',{body:{healthCheck:true}});if(error)throw error;if(!data?.ok)throw new Error(data?.message||'Gemini health check failed.');setGeminiStatus('Ready');notify('Gemini invoice engine is configured and reachable.','success')}catch(error){setGeminiStatus('Unavailable');notify(error?.message||'Gemini invoice engine could not be reached.','error')}finally{setTestingGemini(false)}}
  return <div className="records-page">
    <section className="records-kpi-grid settings-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=><button key={title} className={`records-kpi tone-${tone}`} onClick={()=>setDrawer(title)}><span className="records-kpi-icon"><Icon size={22}/></span><span className="records-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight size={18}/></button>)}</section>
    <section className="records-workspace card-surface"><header className="records-header"><div><h2>Settings</h2><p>Manage business profile, defaults, security, integrations, and interface preferences</p></div><button className="primary-button" onClick={()=>notify("Settings saved locally.")}><Save size={17}/>Save Settings</button></header>
      <div className="payroll-tabs settings-tabs">{['Business','Classifications','Payroll Defaults','Cost Allocation','Invoice Defaults','Integrations','Users & Security','Appearance'].map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}</div>
      <div className="settings-panel">
        {tab==='Business'&&<div className="form-grid"><label>Restaurant Name<input defaultValue="Isabella Restaurant"/></label><label>Business Type<select><option>Family Restaurant</option><option>Fine Dining</option><option>Bar & Grill</option></select></label><label>Phone<input defaultValue="(205) 555-0148"/></label><label>Email<input defaultValue="office@isabellarestaurant.com"/></label><label>Address<input defaultValue="Richmond, AL"/></label><label>Default Currency<select><option>USD</option></select></label></div>}
        {tab==='Classifications'&&<div className="classification-grid">{classificationPanel('expense')}{classificationPanel('category')}</div>}
        {tab==='Payroll Defaults'&&<div className="form-grid"><label>Default Pay Period<select><option>Weekly</option><option>Biweekly</option></select></label><label>Tip Withholding %<input defaultValue="3.5"/></label><label>Kitchen Payment Method<select><option>Cash</option><option>Check</option></select></label><label>Default Check Number<input placeholder="Optional"/></label></div>}
        {tab==='Cost Allocation'&&<div className="allocation-settings"><p className="settings-help">Split shared restaurant costs between Food and Alcohol. Changing either side automatically keeps the rule at 100%.</p><div className="allocation-grid">{[['managerPayroll','Manager Payroll'],['supplies','Supplies'],['cleaningSupplies','Cleaning Supplies'],['cintas','Cintas / Linen'],['utilities','Utilities'],['insurance','Insurance'],['otherShared','Other Shared Costs']].map(([key,label])=><div className="allocation-row" key={key}><strong>{label}</strong><label>Food %<input type="number" min="0" max="100" value={allocations[key]?.food??0} onChange={e=>setAllocation(key,'food',e.target.value)}/></label><label>Alcohol %<input type="number" min="0" max="100" value={allocations[key]?.alcohol??0} onChange={e=>setAllocation(key,'alcohol',e.target.value)}/></label></div>)}</div></div>}
        {tab==='Invoice Defaults'&&<div className="form-grid"><label>Default Payment Type<select><option>Check</option><option>ACH</option><option>Credit</option></select></label><label>Default Due Days<input defaultValue="30"/></label><label>Food Category<select><option>Food</option></select></label><label>Alcohol Category<select><option>Alcohol</option></select></label></div>}
        {tab==='Integrations'&&<div className="settings-list"><div><Database/><span><strong>Supabase</strong><small>{isSupabaseReady?'Production connection configured':'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'}</small></span><button type="button" disabled>{isSupabaseReady?'Connected':'Not Ready'}</button></div><div><Sparkles/><span><strong>Gemini Smart Invoice</strong><small>Secure Supabase Edge Function · {geminiStatus}</small></span><button type="button" onClick={testGemini} disabled={testingGemini}>{testingGemini?'Testing...':'Test Gemini'}</button></div></div>}
        {tab==='Users & Security'&&<div className="settings-list"><div><ShieldCheck/><span><strong>Administrator</strong><small>Full access to all pages and settings</small></span><button onClick={()=>openRoleEditor('Administrator')}>Edit</button></div><div><Users/><span><strong>Manager</strong><small>Operational pages, reports, payroll review</small></span><button onClick={()=>openRoleEditor('Manager')}>Edit</button></div></div>}
        {tab==='Appearance'&&<div className="settings-list"><div><Palette/><span><strong>Approved RestaPay Theme</strong><small>White cards, colored icons, compact ChatGPT-style typography</small></span><button type="button" disabled aria-disabled="true">Active</button></div></div>}
      </div>
    </section>
    <Modal open={Boolean(roleEditor)} title={`${roleEditor||''} Security`} subtitle="Manage login credentials securely through Supabase Auth" onClose={()=>setRoleEditor(null)} footer={<><button className="secondary-action" onClick={()=>setRoleEditor(null)}>Cancel</button><button className="primary-button" onClick={saveRoleSecurity}>Save Security</button></>}><div className="form-grid"><label>Login Email<input type="email" value={securityForm.email} onChange={e=>setSecurityForm({...securityForm,email:e.target.value})}/></label><label>New Password<input type="password" value={securityForm.password} onChange={e=>setSecurityForm({...securityForm,password:e.target.value})} placeholder="Minimum 8 characters"/></label><label>Confirm Password<input type="password" value={securityForm.confirm} onChange={e=>setSecurityForm({...securityForm,confirm:e.target.value})}/></label></div></Modal>
    <DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/>
  </div>
}
