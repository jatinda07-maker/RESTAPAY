import { useState } from 'react'
import { Bell, Building2, ChevronRight, Database, Palette, Save, ShieldCheck, Users } from 'lucide-react'
import DetailDrawer from '../components/DetailDrawer'
import { useFeedback } from '../components/AppFeedback'
import { isSupabaseReady, supabase } from '../lib/supabase.js'

const cards=[
  {title:'Restaurant Profile',value:'Isabella Restaurant',meta:'Business identity',tone:'blue',icon:Building2},
  {title:'Users & Roles',value:'3 users',meta:'Access control',tone:'purple',icon:Users},
  {title:'Data & Backup',value:'Ready',meta:'Live production database',tone:'green',icon:Database},
  {title:'Notifications',value:'Enabled',meta:'Imports and payroll alerts',tone:'orange',icon:Bell},
]
export default function Settings(){
  const[drawer,setDrawer]=useState(null),[tab,setTab]=useState('Business'),[connection,setConnection]=useState(isSupabaseReady?'Ready to test':'Not configured');const {notify}=useFeedback()
  const testSupabase=async()=>{if(!isSupabaseReady){setConnection('Not configured');return notify('Supabase environment variables are missing.','error')}setConnection('Testing...');const {error}=await supabase.from('vendors').select('id').limit(1);if(error){setConnection('Failed');notify(error.message,'error')}else{setConnection('Connected');notify('Supabase connection is live.')}}
  return <div className="records-page">
    <section className="records-kpi-grid settings-kpi-grid">{cards.map(({title,value,meta,tone,icon:Icon})=><button key={title} className={`records-kpi tone-${tone}`} onClick={()=>setDrawer(title)}><span className="records-kpi-icon"><Icon size={22}/></span><span className="records-kpi-copy"><strong>{title}</strong><b>{value}</b><small>{meta}</small></span><ChevronRight size={18}/></button>)}</section>
    <section className="records-workspace card-surface"><header className="records-header"><div><h2>Settings</h2><p>Manage business profile, defaults, security, integrations, and interface preferences</p></div><button className="primary-button" onClick={()=>notify("Settings saved.")}><Save size={17}/>Save Settings</button></header>
      <div className="payroll-tabs settings-tabs">{['Business','Payroll Defaults','Invoice Defaults','Users & Security','Appearance'].map(item=><button key={item} className={tab===item?'active':''} onClick={()=>setTab(item)}>{item}</button>)}</div>
      <div className="settings-panel">
        {tab==='Business'&&<div className="form-grid"><label>Restaurant Name<input defaultValue="Isabella Restaurant"/></label><label>Business Type<select><option>Family Restaurant</option><option>Fine Dining</option><option>Bar & Grill</option></select></label><label>Phone<input defaultValue="(205) 555-0148"/></label><label>Email<input defaultValue="office@isabellarestaurant.com"/></label><label>Address<input defaultValue="Richmond, AL"/></label><label>Default Currency<select><option>USD</option></select></label></div>}
        {tab==='Payroll Defaults'&&<div className="form-grid"><label>Default Pay Period<select><option>Weekly</option><option>Biweekly</option></select></label><label>Tip Withholding %<input defaultValue="3.5"/></label><label>Kitchen Payment Method<select><option>Cash</option><option>Check</option></select></label><label>Default Check Number<input placeholder="Optional"/></label></div>}
        {tab==='Invoice Defaults'&&<div className="form-grid"><label>Default Payment Type<select><option>Check</option><option>ACH</option><option>Credit</option></select></label><label>Default Due Days<input defaultValue="30"/></label><label>Food Category<select><option>Food</option></select></label><label>Alcohol Category<select><option>Alcohol</option></select></label></div>}
        {tab==='Users & Security'&&<div className="settings-list"><div><ShieldCheck/><span><strong>Administrator</strong><small>Full access to all pages and settings</small></span><button onClick={()=>notify("Role editor opened for review.","info")}>Edit</button></div><div><Users/><span><strong>Manager</strong><small>Operational pages, reports, payroll review</small></span><button onClick={()=>notify("Role editor opened for review.","info")}>Edit</button></div></div>}
        {tab==='Business'&&<div className="settings-list"><div><Database/><span><strong>Supabase</strong><small>{connection}</small></span><button onClick={testSupabase}>Test Connection</button></div></div>}
        {tab==='Appearance'&&<div className="settings-list"><div><Palette/><span><strong>Approved RestaPay Theme</strong><small>White cards, colored icons, compact ChatGPT-style typography</small></span><button>Active</button></div></div>}
      </div>
    </section>
    <DetailDrawer title={drawer} onClose={()=>setDrawer(null)}/>
  </div>
}
