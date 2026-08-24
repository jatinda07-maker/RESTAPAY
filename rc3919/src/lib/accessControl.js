import { useEffect, useMemo, useState } from 'react'
import { isSupabaseReady, supabase } from './supabase.js'

export const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: ['reports.view','reports.create','sales.view','sales.upload','shift.upload','invoices.view','invoices.upload','invoices.create','invoices.edit.request'],
  viewer: ['reports.view']
}
export const MANAGER_ROUTES = new Set(['/reports','/sales','/import-center','/invoices'])
export function hasPermission(role='admin',permission=''){const list=ROLE_PERMISSIONS[role]||[];return list.includes('*')||list.includes(permission)}
export function canAccessRoute(role='admin',path='/'){if(role==='admin')return true;if(role==='manager')return MANAGER_ROUTES.has(path);return path==='/reports'}

export function useAccessControl(){
  const [role,setRole]=useState(()=>localStorage.getItem('restapay-current-role')||'admin')
  const [identity,setIdentity]=useState({email:'',userId:''})
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
    load()
    const{data:sub}=isSupabaseReady?supabase.auth.onAuthStateChange(()=>load()):{data:null}
    return()=>{active=false;window.removeEventListener('restapay:role-change',syncRole);window.removeEventListener('storage',storageRole);sub?.subscription?.unsubscribe?.()}
  },[])
  const applyRole=next=>{const value=['admin','manager','viewer'].includes(next)?next:'manager';localStorage.setItem('restapay-current-role',value);setRole(value);window.dispatchEvent(new CustomEvent('restapay:role-change',{detail:{role:value}}));return true}
  const setCurrentRole=next=>next==='admin'&&role!=='admin'?false:applyRole(next)
  const unlockAdmin=async pin=>{if(!/^\d{4,6}$/.test(String(pin||'')))return false;if(!isSupabaseReady)throw new Error('Supabase is required for Admin PIN verification.');const{data,error}=await supabase.rpc('verify_admin_pin',{candidate:String(pin)});if(error)throw error;if(!data)return false;return applyRole('admin')}
  const lockAdmin=()=>applyRole('manager')
  const setAdminPin=async pin=>{if(!/^\d{4,6}$/.test(String(pin||'')))throw new Error('Admin PIN must be 4 to 6 digits.');if(!isSupabaseReady)throw new Error('Supabase is required to store the Admin PIN securely.');const{data,error}=await supabase.rpc('set_admin_pin',{new_pin:String(pin)});if(error)throw error;return Boolean(data)}
  return useMemo(()=>({role,identity,isAdmin:role==='admin',isManager:role==='manager',has:p=>hasPermission(role,p),canRoute:p=>canAccessRoute(role,p),setCurrentRole,unlockAdmin,lockAdmin,setAdminPin}),[role,identity])
}
