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
export const DEFAULT_MANAGER_ACCESS = {
  routes:['/sales','/invoices','/reports','/import-center'],
  reports:{sales:true,cashEmployees:true,tippedEmployees:true,vendorSpending:true,cashBalance:true,periodPL:false,reconciliation:false,payrollDetail:false,customBuilder:false,pdf:true,print:true}
}
export function managerAccess(){const saved=getLiveSetting('restapay-manager-access',DEFAULT_MANAGER_ACCESS)||DEFAULT_MANAGER_ACCESS;return {...DEFAULT_MANAGER_ACCESS,...saved,reports:{...DEFAULT_MANAGER_ACCESS.reports,...(saved.reports||{})}}}
export function canAccessRoute(role='admin',path='/'){if(role==='admin')return true;if(role==='manager')return managerAccess().routes.includes(path);return path==='/reports'}

export function useAccessControl(){
  const [role,setRole]=useState(()=>localStorage.getItem('restapay-current-role')||'admin')
  const [identity,setIdentity]=useState({email:'',userId:''});const [accessVersion,setAccessVersion]=useState(0)
  useEffect(()=>{
    let active=true
    const syncRole=event=>{
      const next=event?.detail?.role||localStorage.getItem('restapay-current-role')||'admin'
      if(active&&['admin','manager','viewer'].includes(next))setRole(next)
    }
    const storageRole=event=>{if(event.key==='restapay-current-role')syncRole()}
    window.addEventListener('restapay:role-change',syncRole)
    window.addEventListener('storage',storageRole)
    const load=async()=>{if(!isSupabaseReady)return;try{const{data}=await supabase.auth.getSession();const user=data?.session?.user;if(!active||!user)return;setIdentity({email:user.email||'',userId:user.id||''});const{data:row,error}=await supabase.from('app_user_roles').select('role').eq('user_id',user.id).maybeSingle();if(!error&&row?.role&&localStorage.getItem('restapay-current-role')!=='manager'){setRole(row.role);localStorage.setItem('restapay-current-role',row.role)}}catch{}}
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
