import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CostAnalysis from './pages/CostAnalysis'
import EntityPage from './pages/EntityPage'
import Employees from './pages/Employees'
import Payroll from './pages/Payroll'
import Vendors from './pages/Vendors'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import MenuCosting from './pages/MenuCosting'
import ImportCenter from './pages/ImportCenter'
import ToastIntegration from './pages/ToastIntegration'
import { useLocalData } from './lib/useLocalData'
import './styles.css'

function App() {
  const [active, setActive] = useState('dashboard')
  const [data, setData] = useLocalData()
  const shared = { data, setData }

  return <Layout active={active} setActive={setActive}>
    {active === 'dashboard' ? <Dashboard data={data} setData={setData} setActive={setActive} />
      : active === 'cost-analysis' ? <CostAnalysis {...shared} />
      : active === 'import-center' ? <ImportCenter {...shared} setActive={setActive} />
      : active === 'toast-integration' ? <ToastIntegration />
      : active === 'employees' ? <Employees {...shared} />
      : active === 'sales' ? <Sales {...shared} />
      : active === 'menu-costing' ? <MenuCosting {...shared} />
      : active === 'vendors' ? <Vendors {...shared} />
      : active === 'invoices' ? <Invoices {...shared} />
      : active === 'payroll' ? <Payroll {...shared} />
      : active === 'expenses' ? <Expenses {...shared} />
      : active === 'reports' ? <Reports {...shared} />
      : active === 'settings' ? <Settings {...shared} />
      : <EntityPage page={active} />}
  </Layout>
}

createRoot(document.getElementById('root')).render(<App />)
