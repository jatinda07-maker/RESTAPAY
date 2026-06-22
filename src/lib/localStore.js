export const RESTAPAY_KEY = 'restapay_v2_local_data'

export const defaultData = {
  employees: [],
  employeeTypes: ['Regular', 'Manager', 'Kitchen', 'Front House', 'Seasonal', 'Other'],
  jobTypes: ['Bartender', 'Busser', 'Cashier', 'Cook', 'Host', 'Kitchen', 'Manager', 'Server', 'Other'],
  payrollGroups: [],
  payrollEntries: [],
  payrollImports: [],
  vendors: [],
  vendorCategories: ['Food', 'Beverage', 'Beer', 'Liquor', 'Utilities', 'Insurance', 'Supplies', 'Maintenance', 'Other'],
  expenses: [],
  expenseCategories: ['Restaurant Expenses', 'Loans', 'Accounting Fees', 'Utilities', 'Supplies', 'Maintenance', 'Insurance', 'Cash Expenses', 'Other'],
  paymentMethods: ['Cash', 'Check', 'Credit', 'ACH'],
  invoices: [],
  invoiceItems: [],
  salesDays: [],
  salesImports: [],
  customReports: [],
  settings: { tipWithholdingRate: 3.5, geminiApiKey: '' }
}

function mergeData(data) {
  return {
    ...defaultData,
    ...(data || {}),
    employees: data?.employees || defaultData.employees,
    employeeTypes: data?.employeeTypes || defaultData.employeeTypes,
    jobTypes: data?.jobTypes || defaultData.jobTypes,
    payrollGroups: data?.payrollGroups || defaultData.payrollGroups,
    payrollEntries: data?.payrollEntries || defaultData.payrollEntries,
    payrollImports: data?.payrollImports || defaultData.payrollImports,
    vendors: data?.vendors || defaultData.vendors,
    vendorCategories: data?.vendorCategories || defaultData.vendorCategories,
    expenses: data?.expenses || defaultData.expenses,
    expenseCategories: data?.expenseCategories || defaultData.expenseCategories,
    paymentMethods: data?.paymentMethods || defaultData.paymentMethods,
    invoices: data?.invoices || defaultData.invoices,
    invoiceItems: data?.invoiceItems || defaultData.invoiceItems,
    salesDays: data?.salesDays || defaultData.salesDays,
    salesImports: data?.salesImports || defaultData.salesImports,
    customReports: data?.customReports || defaultData.customReports,
    settings: { ...defaultData.settings, ...(data?.settings || {}) }
  }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(RESTAPAY_KEY)
    return raw ? mergeData(JSON.parse(raw)) : defaultData
  } catch (error) {
    console.error('Failed to read local data', error)
    return defaultData
  }
}

export function saveData(data) {
  localStorage.setItem(RESTAPAY_KEY, JSON.stringify(mergeData(data)))
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function sortByName(list) {
  return [...list].sort((a, b) => String(a.name || a).localeCompare(String(b.name || b)))
}
