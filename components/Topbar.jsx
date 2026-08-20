import { Bell, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFeedback } from './AppFeedback'

const pageMeta = {
  '/dashboard': ['Dashboard', 'Executive overview of your restaurant business'],
  '/sales': ['Sales', 'Manage Toast imports, daily sales, payment methods, and sales history'],
  '/food-alcohol-cost': ['Food & Alcohol Cost', 'Track food and alcohol costs by department'],
  '/invoices': ['Invoices', 'Upload invoices, review totals, and organize vendor bills'],
  '/vendors': ['Vendors', 'Manage vendors, categories, contacts, and payment terms'],
  '/vendor-comparison': ['Vendor Comparison', 'Compare invoice item prices, package sizes, and vendor savings'],
  '/price-increase': ['Price Increase', 'Review vendor item increases and pricing risk'],
  '/employees': ['Employees', 'Manage employees, roles, pay types, and status'],
  '/payroll': ['Payroll', 'Process payroll groups, manual payroll, tips, and history'],
  '/expenses': ['Expenses', 'Track restaurant expenses, payment methods, and categories'],
  '/reports': ['Reports', 'Generate weekly reports, exports, and business analysis'],
  '/import-center': ['Import Center', 'Upload and organize restaurant business data'],
  '/toast-integration': ['Toast Integration', 'Monitor automatic Toast exports and imports'],
  '/bank-checks': ['Bank & Checks', 'Reconcile bank checks and business documents'],
  '/settings': ['Settings', 'Manage account and application preferences'],
}

export default function Topbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [profileOpen,setProfileOpen] = useState(false)
  const { notify } = useFeedback()
  const [saveState,setSaveState] = useState('Live')
  const [title, subtitle] = pageMeta[pathname] || ['RestaPay', 'Restaurant business management']

  useEffect(()=>{
    const saved=()=>{setSaveState('Saved');window.setTimeout(()=>setSaveState('Live'),1800)}
    const failed=()=>setSaveState('Save Failed')
    window.addEventListener('restapay:cloud-status',saved)
    window.addEventListener('restapay:cloud-error',failed)
    return()=>{window.removeEventListener('restapay:cloud-status',saved);window.removeEventListener('restapay:cloud-error',failed)}
  },[])

  return (
    <header className="topbar">
      <div className="topbar-page-title"><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="topbar-actions">
        <div className={`save-pill ${saveState==='Save Failed'?'save-pill-error':''}`}><span className="status-dot" />{saveState}</div>
        <button className="icon-button notification-button" type="button" aria-label="Notifications" onClick={()=>notify(saveState==='Save Failed'?'A recent Supabase save failed. Check the latest page error and retry.':'No unread system alerts. Live save and import errors will appear here as they occur.',saveState==='Save Failed'?'error':'info')}>
          <Bell size={19} />
        </button>
        <div className="profile-switch-wrap">
          <button type="button" className="profile-switch-button" aria-expanded={profileOpen} onClick={()=>setProfileOpen(v=>!v)}>
            <div className="avatar">JP</div><div className="user-copy"><strong>Jatin Patel</strong><span>Admin</span></div><ChevronDown size={16} />
          </button>
          {profileOpen&&<div className="profile-switch-menu">
            <button type="button" onClick={()=>{setProfileOpen(false);navigate('/settings')}}>Account & Settings</button>
            <button type="button" onClick={()=>{setProfileOpen(false);navigate('/settings');window.setTimeout(()=>window.dispatchEvent(new CustomEvent('restapay:open-security')),50)}}>Users & Security</button>
          </div>}
        </div>
      </div>
    </header>
  )
}
