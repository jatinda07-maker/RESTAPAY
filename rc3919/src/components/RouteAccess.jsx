import { Navigate, useLocation } from 'react-router-dom'
import { useAccessControl } from '../lib/accessControl.js'
export default function RouteAccess({children}){
  const {role,canRoute}=useAccessControl();const location=useLocation()
  if(canRoute(location.pathname)) return children
  return <Navigate to={role==='manager'?'/reports':'/reports'} replace />
}
