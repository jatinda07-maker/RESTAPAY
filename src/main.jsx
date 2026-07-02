import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import EntityPage from './pages/EntityPage'
import Employees from './pages/Employees'
import Payroll from './pages/Payroll'
import Vendors from './pages/Vendors'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Expenses from './pages/Expenses'
import BankStatementImport from './pages/BankStatementImport'
import { useLocalData } from './lib/useLocalData'
import './styles.css'

function App() {
  const [active, setActive] = useState('dashboard')
  const [data, setData] = useLocalData()
  const shared = { data, setData }

  return <Layout active={active} setActive={setActive}>
    {active === 'dashboard' ? <Dashboard data={data} setActive={setActive} />
      : active === 'employees' ? <Employees {...shared} />
      : active === 'sales' ? <Sales {...shared} />
      : active === 'vendors' ? <Vendors {...shared} />
      : active === 'invoices' ? <Invoices {...shared} />
      : active === 'payroll' ? <Payroll {...shared} />
      : active === 'expenses' ? <Expenses {...shared} />
      : active === 'bank-import' ? <BankStatementImport {...shared} />
      : active === 'reports' ? <Reports {...shared} />
      : active === 'settings' ? <Settings {...shared} />
      : <EntityPage page={active} />}
  </Layout>
}

createRoot(document.getElementById('root')).render(<App />)
