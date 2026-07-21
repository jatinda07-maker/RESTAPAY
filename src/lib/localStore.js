import { diagnosticLogger } from './diagnostics'
import { supabase, isSupabaseReady } from './supabase'

export const RESTAPAY_KEY = 'restapay_v2_local_data'
export const RESTAPAY_LEGACY_KEYS = ['restapay_app_data', 'restapay_data', 'restaPayData', 'restapayLocalData', 'restaurantPayData']
export const RESTAPAY_SUPABASE_STATE_ID = 'main'
export const RESTAPAY_CLOUD_STATUS_EVENT = 'restapay-cloud-status'
export const RESTAPAY_PENDING_CLOUD_KEY = 'restapay_pending_cloud_save'

export function announceCloudStatus(status, detail = {}) {
  const payload = { status, at: new Date().toISOString(), ...detail }
  try { localStorage.setItem('restapay_cloud_status', JSON.stringify(payload)) } catch {}
  try { window.dispatchEvent(new CustomEvent(RESTAPAY_CLOUD_STATUS_EVENT, { detail: payload })) } catch {}
}

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
  toastSalesCategories: [],
  salesImports: [],
  menuItems: [],
  menuRecipes: [],
  menuImports: [],
  importHistory: [],
  customReports: [],
  settings: {
    tipWithholdingRate: 3.5,
    defaultAlcoholSalesPercent: 25,
    dashboardVisibility: {
      netSales: true, cashCollected: true, operatingProfit: true, cashRemaining: true,
      operatingPayroll: true, vendorSpend: true, businessExpenses: true, serverTips: true,
      primeCost: true, trueFoodCost: true, trueAlcoholCost: true,
      restaurantHealth: true, departmentProfitability: true, cashPosition: true,
      profitLoss: true, salesPerformance: true, vendorPurchases: true, businessExpensePanel: true,
      weeklySalesTrend: true, spendingTrend: true, restaurantIntelligence: true
    },
    departmentAllocations: {
      managerPayroll: { food: 50, alcohol: 50 },
      kitchenPayroll: { food: 100, alcohol: 0 },
      bartenderPayroll: { food: 0, alcohol: 100 },
      supplies: { food: 100, alcohol: 0 },
      cleaningSupplies: { food: 50, alcohol: 50 },
      cintas: { food: 50, alcohol: 50 },
      utilities: { food: 50, alcohol: 50 },
      insurance: { food: 50, alcohol: 50 }
    }
  }
}

export function mergeData(data) {
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
    toastSalesCategories: data?.toastSalesCategories || defaultData.toastSalesCategories,
    salesImports: data?.salesImports || defaultData.salesImports,
    menuItems: data?.menuItems || defaultData.menuItems,
    menuRecipes: data?.menuRecipes || defaultData.menuRecipes,
    menuImports: data?.menuImports || defaultData.menuImports,
    importHistory: data?.importHistory || defaultData.importHistory,
    customReports: data?.customReports || defaultData.customReports,
    settings: { ...defaultData.settings, ...(data?.settings || {}) }
  }
}

export function loadData() {
  // Supabase is the only persistent source of truth. Remove legacy local data
  // so stale browser records can never overwrite or confuse cloud records.
  try {
    ;[RESTAPAY_KEY, RESTAPAY_PENDING_CLOUD_KEY, ...RESTAPAY_LEGACY_KEYS].forEach(key => localStorage.removeItem(key))
  } catch {}
  return mergeData(defaultData)
}

export function saveData() {
  // Intentionally disabled: business data is persisted only in Supabase.
}

export function hasMeaningfulData(data) {
  const merged = mergeData(data)
  return [
    merged.employees,
    merged.payrollGroups,
    merged.payrollEntries,
    merged.payrollImports,
    merged.vendors,
    merged.expenses,
    merged.invoices,
    merged.invoiceItems,
    merged.salesDays,
    merged.toastSalesCategories,
    merged.salesImports,
    merged.menuItems,
    merged.menuRecipes,
    merged.menuImports,
    merged.importHistory,
    merged.customReports
  ].some(list => Array.isArray(list) && list.length > 0)
}


function normalizeTableData(tableData = {}) {
  return mergeData({
    employees: tableData.employees || [],
    employeeTypes: (tableData.employee_types || []).map(row => row.name).filter(Boolean),
    jobTypes: (tableData.job_types || []).map(row => row.name).filter(Boolean),
    payrollGroups: (tableData.payroll_groups || []).map(row => ({
      ...row,
      memberIds: row.member_ids || row.memberIds || [],
      payment_method: row.method || row.payment_method || 'Cash'
    })),
    payrollEntries: (tableData.payroll_entries || []).map(row => ({
      ...row,
      employee_name: row.employee_name,
      payment_method: row.method || row.payment_method || row.payroll_type || 'Cash',
      payroll_type: row.method || row.payment_method || row.payroll_type || 'Cash',
      pay_date: row.payroll_date || row.pay_date || row.date,
      tips_after_withholding: row.tips_after_withheld || row.tips_after_withholding || row.final_tips,
      total_pay: row.total || row.total_pay || row.amount
    })),
    payrollImports: tableData.payroll_imports || [],
    vendors: (tableData.vendors || []).map(row => ({ ...row, is_active: row.active !== false })),
    vendorCategories: (tableData.vendor_categories || []).map(row => row.name).filter(Boolean),
    expenses: (tableData.expenses || []).map(row => ({
      ...row,
      _source_table: 'expenses',
      date: row.expense_date || row.date,
      payment_method: row.payment_type || row.payment_method,
      is_active: row.active !== false
    })),
    expenseCategories: (tableData.expense_categories || []).map(row => row.name).filter(Boolean),
    paymentMethods: (tableData.payment_methods || []).map(row => row.name).filter(Boolean),
    invoices: (tableData.invoices || []).map(row => ({
      ...row,
      _source_table: 'invoices',
      vendor: row.vendor_name || row.vendor || row.name,
      date: row.invoice_date || row.date,
      payment_method: row.payment_type || row.payment_method,
      invoice_type: row.invoice_type || invoiceType(row),
      total: signedInvoiceTotal(row)
    })),
    invoiceItems: (tableData.invoice_items || []).map(row => ({ ...row, _source_table: 'invoice_items' })),
    salesDays: (tableData.sales_days || []).map(row => ({ ...row, date: row.business_date || row.date })),
    toastSalesCategories: (tableData.toast_sales_categories || []).map(row => ({
      ...row,
      category: row.category_name || row.category || row.sales_category || row.name,
      salesAmount: money(row.net_sales ?? row.sales_amount ?? row.amount),
      itemCount: money(row.quantity ?? row.item_count ?? row.items),
      business_date: row.business_date || row.date,
      department: String(row.normalized_department || row.department || row.department_type || '').toLowerCase()
    })),
    salesImports: tableData.sales_imports || [],
    menuItems: tableData.menu_items || [],
    menuRecipes: (tableData.menu_recipes || []).map(row => ({ ...row, lines: row.lines || [] })),
    menuImports: tableData.menu_imports || [],
    customReports: tableData.custom_reports || [],
    settings: tableData.settings?.[0]?.app_settings || defaultData.settings
  })
}

async function loadCloudTables() {
  if (!isSupabaseReady) return null
  try {
    const tableNames = [
      'employees', 'employee_types', 'job_types', 'payroll_groups', 'payroll_entries', 'payroll_imports',
      'vendors', 'vendor_categories', 'expenses', 'expense_categories', 'payment_methods',
      'invoices', 'invoice_items', 'sales_days', 'toast_sales_categories', 'sales_imports', 'menu_items', 'menu_recipes', 'menu_imports', 'custom_reports', 'settings'
    ]
    const loaded = {}
    const successful = new Set()
    const failed = {}

    await Promise.all(tableNames.map(async table => {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        failed[table] = error.message || String(error); diagnosticLogger.warn('Supabase Table', `Unable to read ${table}`, { table, error: error.message || String(error) })
        loaded[table] = []
        return
      }
      successful.add(table)
      loaded[table] = data || []
    }))

    return { data: normalizeTableData(loaded), successful, failed }
  } catch (error) {
    diagnosticLogger.error('Supabase', 'Failed to read normalized Supabase tables', { error }); console.error('Failed to read Supabase tables.', error)
    return null
  }
}

export async function loadCloudData() {
  if (!isSupabaseReady) return null

  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('data')
      .eq('id', RESTAPAY_SUPABASE_STATE_ID)
      .maybeSingle()

    if (error) throw error

    const appData = data?.data && hasMeaningfulData(data.data) ? mergeData(data.data) : null
    const cloudTables = await loadCloudTables()
    const tableData = cloudTables?.data || null
    const successful = cloudTables?.successful || new Set()

    // Normalized Supabase tables are authoritative even when a table is empty.
    // app_data is only a compatibility backup for tables that could not be read.
    const choose = (table, tableKey, appKey = tableKey) => successful.has(table)
      ? (tableData?.[tableKey] || [])
      : (appData?.[appKey] || [])

    const merged = appData || tableData ? mergeData({
      ...(appData || {}),
      employees: choose('employees', 'employees'),
      payrollGroups: choose('payroll_groups', 'payrollGroups'),
      payrollEntries: choose('payroll_entries', 'payrollEntries'),
      payrollImports: choose('payroll_imports', 'payrollImports'),
      vendors: choose('vendors', 'vendors'),
      expenses: choose('expenses', 'expenses'),
      invoices: choose('invoices', 'invoices'),
      invoiceItems: choose('invoice_items', 'invoiceItems'),
      salesDays: choose('sales_days', 'salesDays'),
      toastSalesCategories: choose('toast_sales_categories', 'toastSalesCategories'),
      salesImports: choose('sales_imports', 'salesImports'),
      menuItems: choose('menu_items', 'menuItems'),
      menuRecipes: choose('menu_recipes', 'menuRecipes'),
      menuImports: choose('menu_imports', 'menuImports'),
      customReports: choose('custom_reports', 'customReports'),
      settings: successful.has('settings') ? (tableData?.settings || defaultData.settings) : (appData?.settings || defaultData.settings)
    }) : null

    if (merged) {
      diagnosticLogger.success('Supabase', 'Loaded application data from database', { tables: Array.from(successful) }); announceCloudStatus('saved', { message: 'Loaded from database', source: 'cloud-load' })
    } else {
      announceCloudStatus('saved', { message: 'Cloud connected', source: 'cloud-load' })
    }

    return merged
  } catch (error) {
    diagnosticLogger.error('Supabase', 'Cloud load failed', { error }); console.error('Failed to read Supabase data.', error)
    return null
  }
}

function firstPresent(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function money(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = String(value ?? 0).trim()
  const negativeByParens = /^\s*\(.*\)\s*$/.test(raw)
  const negativeByCredit = /\b(credit|rebate|refund|return)\b/i.test(raw)
  const cleaned = raw.replace(/[$,()]/g, '').trim()
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return 0
  const valueAbs = Math.abs(n)
  return negativeByParens || negativeByCredit || n < 0 ? -valueAbs : valueAbs
}
function invoiceType(row = {}) {
  const text = [row.invoice_type, row.status, row.notes, row.source_file, row.file_name, row.invoice_number, row.vendor_name, row.category]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (text.includes('rebate')) return 'Rebate'
  if (text.includes('credit memo') || text.includes('credit')) return 'Credit Memo'
  if (text.includes('return')) return 'Return Credit'
  if (text.includes('adjustment')) return 'Vendor Adjustment'
  return row.invoice_type || (money(row.total || row.amount) < 0 ? 'Credit Memo' : 'Regular Invoice')
}
function signedInvoiceTotal(row = {}) {
  const amount = money(row.total || row.amount || row.invoice_total || row.grand_total)
  if (['Rebate', 'Credit Memo', 'Return Credit', 'Vendor Adjustment'].includes(invoiceType(row))) return -Math.abs(amount)
  return amount
}
function text(value) { return String(value || '') }
function dateOrNull(value) { return value || null }
function slug(value) { return text(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${Date.now()}` }
function rowId(prefix, row, index) { return row.id || `${prefix}-${Date.now()}-${index}` }

async function replaceTable(table, rows, deleteFirst = true) {
  if (deleteFirst) {
    const { error: deleteError } = await supabase.from(table).delete().neq('id', '__never__')
    if (deleteError) throw deleteError
  }

  if (!rows.length) return

  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
  if (error) throw error
}

async function mirrorAppDataToTables(data) {
  const now = new Date().toISOString()

  const employees = (data.employees || []).map(row => ({
    id: row.id,
    name: text(row.name) || 'Unnamed employee',
    employee_type: row.employee_type || 'Regular',
    job_type: row.job_type || 'Other',
    pay_type: row.pay_type || 'Hourly',
    payroll_type: row.payroll_type || row.method || 'Cash',
    default_check_number: text(row.default_check_number || row.check_number),
    base_pay: money(row.base_pay),
    extra_pay: money(row.extra_pay),
    extra_reason: text(row.extra_reason),
    active: row.is_active !== false && row.active !== false,
    phone: text(row.phone),
    email: text(row.email),
    notes: text(row.notes),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const vendors = (data.vendors || []).map(row => ({
    id: row.id,
    name: text(row.name) || 'Unnamed vendor',
    category: row.category || 'Other',
    contact: text(row.contact),
    phone: text(row.phone),
    email: text(row.email),
    default_check_number: text(row.default_check_number || row.check_number),
    notes: text(row.notes),
    active: row.is_active !== false && row.active !== false,
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const payrollGroups = (data.payrollGroups || []).map(row => ({
    id: row.id,
    name: text(row.name) || 'Payroll group',
    method: row.payment_method || row.payroll_type || row.method || row.type || 'Cash',
    notes: text(row.notes),
    member_ids: row.memberIds || row.member_ids || [],
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const payrollEntries = (data.payrollEntries || []).map(row => ({
    id: row.id,
    employee_id: row.employee_id || null,
    employee_name: text(row.employee_name) || 'Unknown employee',
    source: row.source || row.group_name || 'Manual',
    pay_type: row.pay_type || 'Hourly',
    method: row.payment_method || row.payroll_type || row.method || row.type || 'Cash',
    check_number: text(row.check_number),
    payroll_date: row.pay_date || row.payroll_date || new Date().toISOString().slice(0, 10),
    hours: money(row.hours),
    regular_pay: money(row.regular_pay),
    tips_after_withheld: money(row.tips_after_withholding || row.tips_after_withheld || row.final_tips || row.tips),
    tips_withheld: money(row.tips_withheld || row.tips_withholding || row.tip_deduction),
    extra_pay: money(row.extra_pay),
    extra_reason: text(row.extra_reason),
    total: money(row.total_pay || row.total || row.amount),
    group_id: row.group_id || null,
    group_name: text(row.group_name),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const payrollImports = (data.payrollImports || []).map(row => ({
    id: row.id,
    file_name: row.file_name || row.name || 'Payroll import',
    row_count: Number(row.row_count || row.count || 0),
    created_at: row.created_at || now
  }))

  const invoices = (data.invoices || []).map(row => ({
    id: row.id,
    vendor_id: row.vendor_id || null,
    vendor_name: text(row.vendor_name),
    invoice_number: text(row.invoice_number),
    invoice_date: row.invoice_date || row.date || new Date().toISOString().slice(0, 10),
    due_date: dateOrNull(row.due_date),
    category: row.category || 'Other',
    payment_type: row.payment_type || row.payment_method || 'Check',
    check_number: text(row.check_number),
    invoice_type: invoiceType(row),
    subtotal: money(row.subtotal),
    tax: money(row.tax),
    total: signedInvoiceTotal(row),
    status: row.status || 'Open',
    source_file: text(row.source_file),
    notes: text(row.notes),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const invoiceIds = new Set(invoices.map(invoice => invoice.id).filter(Boolean))

  const invoiceItems = (data.invoiceItems || [])
    .filter(row => row.invoice_id && invoiceIds.has(row.invoice_id))
    .map((row, index) => {
      const quantity = money(firstPresent(row.quantity, row.qty, row.count, 1))
      const unitPrice = money(firstPresent(row.unit_price, row.price, row.rate, row.cost, 0))
      const lineTotal = money(firstPresent(row.line_total, row.total, row.amount, quantity * unitPrice))

      return {
        id: rowId('invoice-item', row, index),
        invoice_id: row.invoice_id,
        description: text(firstPresent(row.description, row.item_name, row.name)),
        item_name: text(firstPresent(row.item_name, row.description, row.name)),
        quantity,
        unit: text(row.unit),
        item_number: text(row.item_number),
        brand: text(row.brand),
        package_size: text(row.package_size || row.package_label),
        pack_count: money(row.pack_count),
        unit_size_value: money(row.unit_size_value),
        unit_size_unit: text(row.unit_size_unit),
        normalized_unit: text(row.normalized_unit),
        normalized_unit_cost: money(row.normalized_unit_cost),
        unit_price: unitPrice,
        line_total: lineTotal,
        category: row.category || 'Other',
        created_at: row.created_at || now
      }
    })

  const salesDays = (data.salesDays || []).map(row => ({
    id: row.id,
    business_date: row.business_date || row.date || new Date().toISOString().slice(0, 10),
    gross_sales: money(row.gross_sales),
    net_sales: money(row.net_sales),
    cash_sales: money(row.cash_sales),
    credit_sales: money(row.credit_sales),
    gift_card_sales: money(row.gift_card_sales),
    online_orders: money(row.online_orders),
    delivery_orders: money(row.delivery_orders),
    pickup_orders: money(row.pickup_orders),
    tips: money(row.tips),
    tips_collected: money(row.tips_collected),
    tips_withheld: money(row.tips_withheld),
    tips_after_withholding: money(row.tips_after_withholding),
    food_sales: money(row.food_sales),
    alcohol_sales: money(row.alcohol_sales),
    other_sales: money(row.other_sales),
    excluded_sales: money(row.excluded_sales),
    food_sales_categories: Array.isArray(row.food_sales_categories) ? row.food_sales_categories : [],
    alcohol_sales_categories: Array.isArray(row.alcohol_sales_categories) ? row.alcohol_sales_categories : [],
    other_sales_categories: Array.isArray(row.other_sales_categories) ? row.other_sales_categories : [],
    excluded_sales_categories: Array.isArray(row.excluded_sales_categories) ? row.excluded_sales_categories : [],
    refunds: money(row.refunds),
    voids: money(row.voids),
    discounts: money(row.discounts),
    tax: money(row.tax),
    guest_count: money(row.guest_count),
    source_file: text(row.source_file),
    import_note: text(row.import_note),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const toastSalesCategories = (data.salesDays || []).flatMap(row => {
    const date = row.business_date || row.date || new Date().toISOString().slice(0, 10)
    const sourceFile = text(row.source_file)
    const groups = [
      ['food', row.food_sales_categories],
      ['alcohol', row.alcohol_sales_categories],
      ['other', row.other_sales_categories],
      ['excluded', row.excluded_sales_categories]
    ]
    return groups.flatMap(([department, values]) => (Array.isArray(values) ? values : []).map((entry, index) => ({
      id: `${row.id || date}-${department}-${index}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
      business_date: date,
      category_name: text(entry.category || entry.name) || 'Unclassified',
      normalized_department: department,
      quantity: money(entry.itemCount ?? entry.items),
      net_sales: money(entry.salesAmount ?? entry.netSales ?? entry.amount),
      source_file: sourceFile,
      created_at: row.created_at || now,
      updated_at: row.updated_at || now
    })))
  })

  const salesImports = (data.salesImports || []).map(row => ({
    id: row.id,
    file_name: row.file_name || row.name || 'Sales import',
    row_count: Number(row.row_count || row.count || 0),
    created_at: row.created_at || now
  }))

  const expenses = (data.expenses || []).map(row => ({
    id: row.id,
    expense_date: row.expense_date || row.date || new Date().toISOString().slice(0, 10),
    name: text(row.name || row.category) || 'Expense',
    vendor: text(row.vendor),
    category: row.category || 'Other',
    payment_type: row.payment_type || row.payment_method || 'Cash',
    check_number: text(row.check_number),
    amount: money(row.amount),
    notes: text(row.notes),
    recurring: Boolean(row.recurring),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const customReports = (data.customReports || []).map(row => ({
    id: row.id,
    name: text(row.name) || 'Custom Report',
    report_type: row.report_type || row.source || 'Custom',
    fields: row.fields || [],
    filters: row.filters || {},
    template: row.template || row,
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const employeeTypes = (data.employeeTypes || []).map(name => ({ id: slug(name), name }))
  const jobTypes = (data.jobTypes || []).map(name => ({ id: slug(name), name }))
  const vendorCategories = (data.vendorCategories || []).map(name => ({ id: slug(name), name }))
  const expenseCategories = (data.expenseCategories || []).map(name => ({ id: slug(name), name }))
  const paymentMethods = (data.paymentMethods || []).map(name => ({ id: slug(name), name }))

  await replaceTable('invoice_items', [])
  await replaceTable('invoices', invoices)
  await replaceTable('invoice_items', invoiceItems, false)
  await replaceTable('employees', employees)
  await replaceTable('vendors', vendors)
  await replaceTable('payroll_groups', payrollGroups)
  await replaceTable('payroll_entries', payrollEntries)
  await replaceTable('payroll_imports', payrollImports)
  await replaceTable('sales_days', salesDays)
  // This table is present in RC12/RC13 schemas. If an older database lacks a
  // compatible column, app_data and sales_days still retain the category arrays.
  try { await replaceTable('toast_sales_categories', toastSalesCategories) } catch (error) { console.warn('Toast category mirror skipped.', error) }
  await replaceTable('sales_imports', salesImports)
  await replaceTable('expenses', expenses)
  await replaceTable('custom_reports', customReports)
  await replaceTable('employee_types', employeeTypes)
  await replaceTable('job_types', jobTypes)
  await replaceTable('vendor_categories', vendorCategories)
  await replaceTable('expense_categories', expenseCategories)
  await replaceTable('payment_methods', paymentMethods)

  const { error: settingsError } = await supabase.from('settings').upsert({
    id: 'main',
    tip_withholding_rate: money(data.settings?.tipWithholdingRate ?? 3.5),
    gemini_model: data.settings?.geminiModel || 'gemini-2.5-flash',
    app_settings: data.settings || {},
    updated_at: now
  }, { onConflict: 'id' })
  if (settingsError) throw settingsError
}

export async function saveCloudData(data, options = {}) {
  window.__restapayCloudSavePending = true
  if (!isSupabaseReady) {
    announceCloudStatus('offline', { message: 'Supabase is not configured. Data has not been saved.', source: options.source || 'direct-save' })
    return { ok: false, reason: 'Supabase env vars missing' }
  }

  try {
    const merged = mergeData(data)
    announceCloudStatus('saving', { message: 'Saving directly to Supabase...', source: options.source || 'direct-save' })
    await mirrorAppDataToTables(merged)

    const payload = {
      id: RESTAPAY_SUPABASE_STATE_ID,
      data: merged,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase.from('app_data').upsert(payload, { onConflict: 'id' })
    if (error) throw error

    window.__restapayCloudSavePending = false
    diagnosticLogger.success('Supabase', 'Saved normalized tables and backup state', { source: options.source || 'direct-save' })
    announceCloudStatus('saved', { message: 'Saved to Supabase', source: options.source || 'direct-save' })
    return { ok: true }
  } catch (error) {
    window.__restapayCloudSavePending = true
    announceCloudStatus('offline', { message: 'Supabase save failed. Data is not saved; remain on this screen and retry.', source: options.source || 'direct-save', error: error?.message || String(error) })
    diagnosticLogger.error('Supabase', 'Database save failed', { error, source: options.source || 'direct-save' })
    console.error('Failed to save Supabase data.', error)
    return { ok: false, error }
  }
}

export async function retryPendingCloudSave() {
  return { ok: true, reason: 'Local pending saves are disabled in Supabase-only mode' }
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function sortByName(list) {
  return [...list].sort((a, b) => String(a.name || a).localeCompare(String(b.name || b)))
}
