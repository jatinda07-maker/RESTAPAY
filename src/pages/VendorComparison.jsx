import {useMemo,useState} from 'react'
import {ChevronDown,ChevronRight,ExternalLink,Globe2,Search,Store,Tag,TrendingDown,WalletCards} from 'lucide-react'
import DateToolbar from '../components/DateToolbar'
import DetailDrawer from '../components/DetailDrawer'
import {appMoney2,useAppData} from '../hooks/useAppData'
import usePersistentState from '../hooks/usePersistentState'
import {isSupabaseReady,supabase} from '../lib/supabase.js'
import {useFeedback} from '../components/AppFeedback'

const samsSearchUrl=item=>`https://www.samsclub.com/s/${encodeURIComponent(String(item||'').trim())}`

export default function VendorComparison(){
 const {metrics}=useAppData();const {notify}=useFeedback();const [query,setQuery]=useState(''),[vendorA,setVendorA]=useState('All Vendors'),[vendorB,setVendorB]=useState('All Vendors'),[drawer,setDrawer]=useState(null),[checking,setChecking]=useState('')
 const [onlineBenchmarks,setOnlineBenchmarks]=usePersistentState('restapay-online-price-benchmarks',{})
 const history=metrics.priceHistory||[];const vendors=useMemo(()=>[...new Set(history.map(r=>r.vendor).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'})),[history])
 const comparisons=useMemo(()=>{
   const rows=(metrics.priceComparisons||[]).filter(row=>!query||`${row.item} ${row.item_number||''} ${row.category||''}`.toLowerCase().includes(query.toLowerCase()))
   return rows.filter(row=>{
     if(vendorA==='All Vendors'&&vendorB==='All Vendors')return true
     const names=new Set((row.history||[]).map(r=>r.vendor))
     return (vendorA==='All Vendors'||names.has(vendorA))&&(vendorB==='All Vendors'||names.has(vendorB))
   }).sort((a,b)=>String(a.item||'').localeCompare(String(b.item||''),undefined,{numeric:true,sensitivity:'base'}))
 },[metrics.priceComparisons,query,vendorA,vendorB])
 const savings=comparisons.reduce((s,r)=>s+Number(r.potential_savings||r.savings||0),0)
 const cards=[['Compared Items',comparisons.length,'Normalized item histories','blue',Tag],['Best Vendor Matches',comparisons.filter(x=>Number(x.vendor_count||0)>1).length,'Comparable multi-vendor items','green',Store],['Potential Savings',appMoney2(savings),'For comparable current quantities','purple',TrendingDown],['Invoice Lines',history.length,'Memorized price records','orange',WalletCards]]
 const checkSams=async row=>{
   setChecking(row.key)
   try{
     if(isSupabaseReady){
       const {data,error}=await supabase.functions.invoke('sams-price-check',{body:{query:row.item,comparison_basis:row.comparison_basis,category:row.category}})
       if(!error&&data?.price){
         const entry={provider:"Sam's Club",item:data.item||row.item,price:Number(data.price),unit_price:Number(data.unit_price||data.price),package:data.package||'',url:data.url||samsSearchUrl(row.item),checked_at:new Date().toISOString(),note:data.note||'Public online benchmark; club/member pricing may differ.'}
         setOnlineBenchmarks(prev=>({...prev,[row.key]:entry}));notify(`Sam's Club benchmark found: ${appMoney2(entry.unit_price)}.`);return
       }
     }
     window.open(samsSearchUrl(row.item),'_blank','noopener,noreferrer')
     notify("Automatic Sam's Club price lookup was unavailable, so the matching Sam's search was opened.")
   }catch(error){window.open(samsSearchUrl(row.item),'_blank','noopener,noreferrer');notify(error?.message||"Sam's Club lookup opened in a new tab.",'error')}
   finally{setChecking('')}
 }
 return <div className="records-page"><DateToolbar/><section className="records-kpi-grid">{cards.map(([t,v,m,tone,Icon])=><button key={t} className={`records-kpi tone-${tone}`} onClick={()=>setDrawer(t)}><span className="records-kpi-icon"><Icon size={22}/></span><span className="records-kpi-copy"><strong>{t}</strong><b>{v}</b><small>{m}</small></span><ChevronRight size={18}/></button>)}</section><section className="records-workspace card-surface"><header className="records-header"><div><h2>Vendor Comparison</h2><p>RESTAPAY remembers invoice prices for food, alcohol, supplies and other purchases and compares equivalent normalized quantities across vendors.</p></div></header><div className="records-filterbar"><label className="records-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search item..."/></label><label className="records-select"><select value={vendorA} onChange={e=>setVendorA(e.target.value)}><option>All Vendors</option>{vendors.map(v=><option key={v}>{v}</option>)}</select><ChevronDown size={14}/></label><label className="records-select"><select value={vendorB} onChange={e=>setVendorB(e.target.value)}><option>All Vendors</option>{vendors.map(v=><option key={v}>{v}</option>)}</select><ChevronDown size={14}/></label></div><div className="records-table-wrap"><table className="records-table aligned-table vendor-intelligence-table"><thead><tr><th>Item</th><th>Category</th><th>Basis</th><th>Current Vendor</th><th>Current</th><th>Best Vendor</th><th>Best</th><th>Qty Basis</th><th>Savings</th><th>Online</th></tr></thead><tbody>{comparisons.length?comparisons.map(r=>{const online=onlineBenchmarks?.[r.key];return <tr key={r.key} onClick={()=>setDrawer({title:r.item,rows:r.history})}><td><strong>{r.item}</strong><small>{r.package_size||'Package not specified'}</small></td><td>{r.category||'Other'}</td><td>{r.comparison_basis||'unit'}</td><td>{r.vendor||'—'}</td><td className="numeric">{appMoney2(r.current_price)}</td><td>{r.best_vendor||'—'}</td><td className="numeric price-lower">{appMoney2(r.best_price)}</td><td className="numeric">{Number(r.comparable_quantity||1).toLocaleString()} {r.comparison_basis||'unit'}</td><td className="numeric price-lower">{appMoney2(r.potential_savings||r.savings||0)}</td><td onClick={e=>e.stopPropagation()}>{online?<a className="online-price-chip" href={online.url} target="_blank" rel="noreferrer"><Globe2 size={14}/>{appMoney2(online.unit_price)}<ExternalLink size={12}/></a>:<button className="secondary-action sams-check-action" disabled={checking===r.key} onClick={()=>checkSams(r)}><Globe2 size={14}/>{checking===r.key?'Checking...':"Check Sam's"}</button>}</td></tr>}):<tr><td colSpan="10" className="empty-table-cell">Upload invoices to build price memory. RESTAPAY compares the same normalized quantity before declaring a best vendor.</td></tr>}</tbody></table></div><p className="vendor-intelligence-note">Online benchmarks are kept separate from internal vendor history. Sam's Club pricing can vary by club, membership and fulfillment method; uncertain matches are not automatically treated as your best vendor.</p></section><DetailDrawer title={typeof drawer==='string'?drawer:drawer?.title} entries={drawer?.rows} onClose={()=>setDrawer(null)}/></div>
}
