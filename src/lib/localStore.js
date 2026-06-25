import { supabase, isSupabaseReady } from './supabase'

export const RESTAPAY_KEY = 'restapay_v2_local_data'
export const RESTAPAY_SUPABASE_STATE_ID = 'main'

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
    merged.salesImports,
    merged.customReports
  ].some(list => Array.isArray(list) && list.length > 0)
}

export async function loadCloudData() {
  if (!isSupabaseReady) return null

  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('state')
      .eq('id', RESTAPAY_SUPABASE_STATE_ID)
      .maybeSingle()

    if (error) throw error

    const merged = data?.state && hasMeaningfulData(data.state) ? mergeData(data.state) : null

    if (merged) {
      localStorage.setItem(RESTAPAY_KEY, JSON.stringify(merged))
    }

    return merged
  } catch (error) {
    console.error('Failed to read Supabase data. Falling back to localStorage.', error)
    return null
  }
}

function firstPresent(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '')
}

function money(value) {
  const n = Number(String(value ?? 0).replace(/[$,()]/g, '').trim())
  return Number.isFinite(n) ? n : 0
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
    notes: text(row.notes),
    active: row.is_active !== false && row.active !== false,
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const payrollGroups = (data.payrollGroups || []).map(row => ({
    id: row.id,
    name: text(row.name) || 'Payroll group',
    method: row.payroll_type || row.method || 'Cash',
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
    method: row.payroll_type || row.method || 'Cash',
    payroll_date: row.pay_date || row.payroll_date || new Date().toISOString().slice(0, 10),
    hours: money(row.hours),
    regular_pay: money(row.regular_pay),
    tips_after_withheld: money(row.tips_after_withheld || row.tips),
    tips_withheld: money(row.tips_withheld || row.tip_deduction),
    extra_pay: money(row.extra_pay),
    extra_reason: text(row.extra_reason),
    total: money(row.total || row.total_pay),
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
    subtotal: money(row.subtotal),
    tax: money(row.tax),
    total: money(row.total),
    status: row.status || 'Open',
    source_file: text(row.source_file),
    notes: text(row.notes),
    created_at: row.created_at || now,
    updated_at: row.updated_at || now
  }))

  const invoiceItems = (data.invoiceItems || []).filter(row => row.invoice_id).map((row, index) => {
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

export async function saveCloudData(data) {
  if (!isSupabaseReady) return { ok: false, reason: 'Supabase env vars missing' }

  try {
    const merged = mergeData(data)

    const payload = {
      id: RESTAPAY_SUPABASE_STATE_ID,
      state: merged,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase
      .from('app_data')
      .upsert(payload, { onConflict: 'id' })

    if (error) throw error

    await mirrorAppDataToTables(merged)

    localStorage.setItem(RESTAPAY_KEY, JSON.stringify(merged))

    return { ok: true }
  } catch (error) {
    console.error('Failed to save Supabase data. LocalStorage backup was still saved.', error)
    return { ok: false, error }
  }
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function sortByName(list) {
  return [...list].sort((a, b) => String(a.name || a).localeCompare(String(b.name || b)))
}
