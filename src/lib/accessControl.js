import { useEffect, useMemo, useState } from 'react'
import { isSupabaseReady, supabase } from './supabase.js'

export const ROLE_PERMISSIONS = {
  admin: ['*'],
  manager: [
    'reports.view','reports.create','sales.view','sales.upload','shift.upload',
    'invoices.view','invoices.upload','invoices.create','invoices.edit.request'
  ],
  viewer: ['reports.view']
}

export const MANAGER_ROUTES = new Set(['/reports','/sales','/import-center','/invoices'])

export function hasPermission(role = 'admin', permission = '') {
  const list = ROLE_PERMISSIONS[role] || []
  return list.includes('*') || list.includes(permission)
}

export function canAccessRoute(role = 'admin', path = '/') {
  if (role === 'admin') return true
  if (role === 'manager') return MANAGER_ROUTES.has(path)
  return path === '/reports'
}

export function useAccessControl() {
  const [role,setRole] = useState(()=>localStorage.getItem('restapay-current-role') || 'admin')
  const [identity,setIdentity] = useState({email:'',userId:''})
  useEffect(()=>{
    let active=true
    const load=async()=>{
      if(!isSupabaseReady) return
      try {
        const {data}=await supabase.auth.getSession()
        const user=data?.session?.user
        if(!active||!user) return
        setIdentity({email:user.email||'',userId:user.id||''})
        const {data:row,error}=await supabase.from('app_user_roles').select('role').eq('user_id',user.id).maybeSingle()
        if(!error&&row?.role){setRole(row.role);localStorage.setItem('restapay-current-role',row.role)}
      } catch {}
    }
    load()
    const {data:sub}=isSupabaseReady?supabase.auth.onAuthStateChange(()=>load()):{data:null}
    return ()=>{active=false;sub?.subscription?.unsubscribe?.()}
  },[])
  const setCurrentRole=(next)=>{const value=['admin','manager','viewer'].includes(next)?next:'admin';localStorage.setItem('restapay-current-role',value);setRole(value);window.dispatchEvent(new CustomEvent('restapay:role-change',{detail:{role:value}}))}
  return useMemo(()=>({role,identity,isAdmin:role==='admin',isManager:role==='manager',has:(permission)=>hasPermission(role,permission),canRoute:(path)=>canAccessRoute(role,path),setCurrentRole}),[role,identity])
}
