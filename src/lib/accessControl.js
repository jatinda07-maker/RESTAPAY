import { useEffect, useMemo, useState } from 'react'
import { isSupabaseReady, supabase } from './supabase.js'
import { ensureLiveSetting, getLiveSetting, subscribeLiveData } from '../data/liveDataStore.js'

export const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: ['reports.view','reports.create','sales.view','sales.upload','shift.upload','invoices.view','invoices.upload','invoices.create','invoices.edit.request'],
  viewer: ['reports.view']
}
export const MANAGER_NAV_ITEMS = [
  ['/dashboard','Dashboard'],['/sales','Sales'],['/food-alcohol-cost','Food & Alcohol Cost'],['/invoices','Invoices'],['/vendors','Vendors'],['/vendor-comparison','Vendor Comparison'],['/price-increase','Price Increase'],['/employees','Employees'],['/payroll','Payroll'],['/expenses','Expenses'],['/reports','Reports'],['/import-center','Import Center'],['/toast-integration','Toast Integration'],['/bank-checks','Bank & Checks']
]
export const DASHBOARD_ITEMS = [
  ['netSales','Net Sales'],['cashSales','Cash Sales'],['creditSales','Credit Sales'],['tipsEarned','Tips Earned'],['cashCollected','Cash Collected'],['cashFlow','Cash Flow'],['cashRemaining','Cash Remaining'],['primeCost','Prime Cost'],['operatingProfit','Operating Profit'],['foodCost','Food Cost'],['alcoholCost','Alcohol Cost'],['trueFoodCost','True Food Cost'],['trueAlcoholCost','True Alcohol Cost'],['businessExpenses','Business Expenses'],['managerOtherPayroll','Manager / GM & Other Payroll'],['kitchenPayroll','Kitchen Payroll'],['tipsCheck','Tips Check - Tipped Waiters'],['laborMix','Labor Mix'],['foodAlcoholComparison','Food vs Alcohol Comparison'],['salesTrend','Sales Trend'],['foodLabor','Food & Labor'],['weeklyProfit','Weekly Profit'],['topVendors','Top Vendors'],['recentInvoices','Recent Invoices'],['recentExpenses','Recent Expenses'],['recentPayroll','Recent Payroll'],['quickAccess','Quick Access']
]
export const MANAGER_DASHBOARD_ITEMS = DASHBOARD_ITEMS
export const ADMIN_DASHBOARD_ITEMS = DASHBOARD_ITEMS
export const DEFAULT_ADMIN_DASHBOARD = Object.fromEntries(DASHBOARD_ITEMS.map(([key])=>[key,true]))
export const DEFAULT_MANAGER_DASHBOARD = {
  ...DEFAULT_ADMIN_DASHBOARD,
  primeCost:false,operatingProfit:false,weeklyProfit:false
}
export const DEFAULT_MANAGER_ACCESS = {
  routes:['/dashboard','/sales','/invoices','/reports','/import-center'],
  reports:{sales:true,cashEmployees:true,tippedEmployees:true,vendorSpending:true,cashBalance:true,periodPL:false,reconciliation:false,payrollDetail:false,customBuilder:false,pdf:true,print:true},
  dashboard:DEFAULT_MANAGER_DASHBOARD
}
export function managerAccess(){const saved=getLiveSetting('restapay-manager-access',DEFAULT_MANAGER_ACCESS)||DEFAULT_MANAGER_ACCESS;return {...DEFAULT_MANAGER_ACCESS,...saved,reports:{...DEFAULT_MANAGER_ACCESS.reports,...(saved.reports||{})},dashboard:{...DEFAULT_MANAGER_DASHBOARD,...(saved.dashboard||{})}}}
export function canAccessRoute(role='admin',path='/'){if(role==='admin')return true;if(role==='manager')return managerAccess().routes.includes(path);return path==='/reports'}

export function useAccessControl(){
  const [role,setRole]=useState(()=>{
    // Remember an explicitly unlocked Admin session on this browser. A brand-new
    // browser still starts in Manager mode until the Admin PIN is verified.
    const saved=localStorage.getItem('restapay-current-role')
    return saved==='admin'?'admin':saved==='viewer'?'viewer':'manager'
  })
  const [identity,setIdentity]=useState({email:'',userId:''});const [accessVersion,setAccessVersion]=useState(0)
  useEffect(()=>{
    let active=true
    const syncRole=event=>{
      const next=event?.detail?.role||localStorage.getItem('restapay-current-role')||'manager'
      if(active&&['admin','manager','viewer'].includes(next))setRole(next)
    }
    const storageRole=event=>{if(event.key==='restapay-current-role')syncRole()}
    window.addEventListener('restapay:role-change',syncRole)
    window.addEventListener('storage',storageRole)
    const load=async()=>{if(!isSupabaseReady)return;try{const{data}=await supabase.auth.getSession();const user=data?.session?.user;if(!active||!user)return;setIdentity({email:user.email||'',userId:user.id||''})}catch{}}
    ensureLiveSetting('restapay-manager-access',DEFAULT_MANAGER_ACCESS).catch(()=>{});load()
    const{data:sub}=isSupabaseReady?supabase.auth.onAuthStateChange(()=>load()):{data:null}
    const stopSettings=subscribeLiveData(e=>{if(e?.detail?.key==='restapay-manager-access')setAccessVersion(v=>v+1)});return()=>{active=false;stopSettings?.();window.removeEventListener('restapay:role-change',syncRole);window.removeEventListener('storage',storageRole);sub?.subscription?.unsubscribe?.()}
  },[])
  const applyRole=next=>{const value=['admin','manager','viewer'].includes(next)?next:'manager';localStorage.setItem('restapay-current-role',value);setRole(value);window.dispatchEvent(new CustomEvent('restapay:role-change',{detail:{role:value}}));return true}
  const setCurrentRole=next=>next==='admin'&&role!=='admin'?false:applyRole(next)
  const verifyRolePin=async(targetRole,pin)=>{if(!/^\d{4,6}$/.test(String(pin||'')))return false;if(!isSupabaseReady)throw new Error('Supabase is required for role PIN verification.');const{data,error}=await supabase.rpc('verify_role_pin',{target_role:targetRole,candidate:String(pin)});if(error)throw error;return Boolean(data)}
  const unlockAdmin=async pin=>(await verifyRolePin('admin',pin))?applyRole('admin'):false
  const unlockManager=async pin=>(await verifyRolePin('manager',pin))?applyRole('manager'):false
  const lockAdmin=()=>applyRole('manager')
  const setRolePin=async(targetRole,pin)=>{if(!/^\d{4,6}$/.test(String(pin||'')))throw new Error('PIN must be 4 to 6 digits.');if(!isSupabaseReady)throw new Error('Supabase is required to store role PINs securely.');const{data,error}=await supabase.rpc('set_role_pin',{target_role:targetRole,new_pin:String(pin)});if(error)throw error;return Boolean(data)}
  const setAdminPin=pin=>setRolePin('admin',pin)
  const setManagerPin=pin=>setRolePin('manager',pin)
  return useMemo(()=>({role,identity,isAdmin:role==='admin',isManager:role==='manager',managerAccess:managerAccess(),has:p=>hasPermission(role,p),canRoute:p=>canAccessRoute(role,p),setCurrentRole,unlockAdmin,unlockManager,lockAdmin,setAdminPin,setManagerPin}),[role,identity,accessVersion])
}
