import { useState } from 'react'
import { Bell, Building2, ChevronRight, Database, Palette, Save, ShieldCheck, Sparkles, Users } from 'lucide-react'
import DetailDrawer from '../components/DetailDrawer'
import { useFeedback } from '../components/AppFeedback'
import { isSupabaseReady, supabase } from '../lib/supabase'
import usePersistentState from '../hooks/usePersistentState'
import { DEFAULT_ALLOCATION_RULES } from '../core/engines/DepartmentCostEngine.js'

const cards=[
  {title:'Restaurant Profile',value:'Isabella Restaurant',meta:'Business identity',tone:'blue',icon:Building2},
  {title:'Users & Roles',value:'3 users',meta:'Access control',tone:'purple',icon:Users},
  {title:'Data & Backup',value:isSupabaseReady?'Connected':'Not configured',meta:'Live Supabase connection',tone:'green',icon:Database},
  {title:'Notifications',value:'Enabled',meta:'Imports and payroll alerts',tone:'orange',icon:Bell},
]
export default function Settings(){
  const[drawer,setDrawer]=useState(null),[tab,setTab]=useState('Business'),[geminiStatus,setGeminiStatus]=useState('Not tested'),[testingGemini,setTestingGemini]=useState(false);const {notify}=useFeedback()
  const [costSettings,setCostSettings]=usePersistentState('restapay-cost-settings',{departmentAllocations:DEFAULT_ALLOCATION_RULES})
  const allocations={...DEFAULT_ALLOCATION_RULES,...(costSettings?.departmentAllocations||{})}
  const setAllocation=(key,field,value)=>{const n=Math.max(0,Math.min(100,Number(value)||0));const other=field==='food'?'alcohol':'food';setCostSettings(prev=>({...prev,departmentAllocations:{...DEFAULT_ALLOCATION_RULES,...(prev?.departmentAllocations||{}),[key]:{...(prev?.departmentAllocations?.[key]||DEFAULT_ALLOCATION_RULES[key]),[field]:n,[other]:100-n}}}))}
  const testGemini=async()=>{if(!isSupabaseReady)return notify('Supabase is not configured.','error');setTestingGemini(true);try{const {data,error}=await supabase.functions.invoke('gemini-invoice',{body:{healthCheck:true}});if(error)throw error;if(!data?.ok)throw new Error(data?.message||'Gemini health check failed.');setGeminiStatus('Ready');notify('Gemini invoice engine is configured and reachable.','success')}catch(error){setGeminiStatus('Unavailable');notify(error?.message||'Gemini invoice engine could not be reached.','error')}finally{setTestingGemini(false)}}
  return <div className="records-page">
    <section className="records-kpi-grid settings-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=><button key={title} className={`records-kpi tone-${tone}`} onClick={()=>setDrawer(title)}><span className="records-kpi-icon"><Icon size={22}/></span><span className="records-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight size={18}/></button>)}</section>
    <section className="records-workspace card-surface"><header className="records-header"><div><h2>Settings</h2><p>Manage business profile, defaults, security, integrations, and interface preferences</p></div><button className="primary-button" onClick={()=>notify("Settings saved locally.")}><Save size={17}/>Save Settings</button></header>
      <div className="payroll-tabs settings-tabs">{['Business','Payroll Defaults','Cost Allocation','Invoice Defaults','Integrations','Users & Security','Appearance'].map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}</div>
      <div className="settings-panel">
        {tab==='Business'&&<div className="form-grid"><label>Restaurant Name<input defaultValue="Isabella Restaurant"/></label><label>Business Type<select><option>Family Restaurant</option><option>Fine Dining</option><option>Bar & Grill</option></select></label><label>Phone<input defaultValue="(205) 555-0148"/></label><label>Email<input defaultValue="office@isabellarestaurant.com"/></label><label>Address<input defaultValue="Richmond, AL"/></label><label>Default Currency<select><option>USD</option></select></label></div>}
        {tab==='Payroll Defaults'&&<div className="form-grid"><label>Default Pay Period<select><option>Weekly</option><option>Biweekly</option></select></label><label>Tip Withholding %<input defaultValue="3.5"/></label><label>Kitchen Payment Method<select><option>Cash</option><option>Check</option></select></label><label>Default Check Number<input placeholder="Optional"/></label></div>}
        {tab==='Cost Allocation'&&<div className="allocation-settings"><p className="settings-help">Split shared restaurant costs between Food and Alcohol. Changing either side automatically keeps the rule at 100%.</p><div className="allocation-grid">{[['managerPayroll','Manager Payroll'],['supplies','Supplies'],['cleaningSupplies','Cleaning Supplies'],['cintas','Cintas / Linen'],['utilities','Utilities'],['insurance','Insurance'],['otherShared','Other Shared Costs']].map(([key,label])=><div className="allocation-row" key={key}><strong>{label}</strong><label>Food %<input type="number" min="0" max="100" value={allocations[key]?.food??0} onChange={e=>setAllocation(key,'food',e.target.value)}/></label><label>Alcohol %<input type="number" min="0" max="100" value={allocations[key]?.alcohol??0} onChange={e=>setAllocation(key,'alcohol',e.target.value)}/></label></div>)}</div></div>}
        {tab==='Invoice Defaults'&&<div className="form-grid"><label>Default Payment Type<select><option>Check</option><option>ACH</option><option>Credit</option></select></label><label>Default Due Days<input defaultValue="30"/></label><label>Food Category<select><option>Food</option></select></label><label>Alcohol Category<select><option>Alcohol</option></select></label></div>}
        {tab==='Integrations'&&<div className="settings-list"><div><Database/><span><strong>Supabase</strong><small>{isSupabaseReady?'Production connection configured':'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'}</small></span><button type="button" disabled>{isSupabaseReady?'Connected':'Not Ready'}</button></div><div><Sparkles/><span><strong>Gemini Smart Invoice</strong><small>Secure Supabase Edge Function · {geminiStatus}</small></span><button type="button" onClick={testGemini} disabled={testingGemini}>{testingGemini?'Testing...':'Test Gemini'}</button></div></div>}
        {tab==='Users & Security'&&<div className="settings-list"><div><ShieldCheck/><span><strong>Administrator</strong><small>Full access to all pages and settings</small></span><button onClick={()=>notify("Role editor opened for review.","info")}>Edit</button></div><div><Users/><span><strong>Manager</strong><small>Operational pages, reports, payroll review</small></span><button onClick={()=>notify("Role editor opened for review.","info")}>Edit</button></div></div>}
        {tab==='Appearance'&&<div className="settings-list"><div><Palette/><span><strong>Approved RestaPay Theme</strong><small>White cards, colored icons, compact ChatGPT-style typography</small></span><button type="button" disabled aria-disabled="true">Active</button></div></div>}
      </div>
    </section>
    <DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/>
  </div>
}
