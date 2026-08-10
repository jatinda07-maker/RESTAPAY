import { isSupabaseReady, supabase } from '../lib/supabase.js'

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const money = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const text = value => String(value ?? '').trim()

const configs = {
  'restapay-invoices': { table: 'invoices' },
  'restapay-employees': {
    table: 'employees',
    fromDb: r => ({
      ...r,
      job: r.job_type || r.job || 'Other',
      type: r.employee_type || r.type || 'Regular',
      method: r.payroll_type || r.method || 'Cash',
      basePay: money(r.base_pay ?? r.basePay),
      status: r.active === false ? 'Inactive' : 'Active',
      is_active: r.active !== false
    }),
    toDb: r => ({ id:r.id||id(), name:text(r.name)||'Unnamed employee', employee_type:r.employee_type||r.type||'Regular', job_type:r.job_type||r.job||'Other', pay_type:r.pay_type||'Hourly', payroll_type:r.payroll_type||r.method||'Cash', default_check_number:text(r.default_check_number||r.check_number), base_pay:money(r.base_pay ?? r.basePay), extra_pay:money(r.extra_pay), extra_reason:text(r.extra_reason), active:r.status ? String(r.status).toLowerCase() !== 'inactive' : (r.is_active!==false&&r.active!==false), phone:text(r.phone), email:text(r.email), notes:text(r.notes), created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-vendors': {
    table: 'vendors',
    fromDb: r => ({ ...r, is_active:r.active!==false, type:r.vendor_type||r.type||'Inventory Purchase', expenseType:r.expense_type||r.expenseType||'', logoUrl:r.logo_url||'', websiteDomain:r.website_domain||'' }),
    toDb: r => ({ id:r.id||id(), name:text(r.name)||'Unnamed vendor', category:r.category||'Other', contact:text(r.contact), phone:text(r.phone), email:text(r.email), default_check_number:text(r.default_check_number||r.check_number), notes:text(r.notes), active:r.is_active!==false&&r.active!==false, vendor_type:r.type||r.vendor_type||null, expense_type:r.expenseType||r.expense_type||null, website:r.website||null, website_domain:r.websiteDomain||r.website_domain||null, logo_url:r.logoUrl||r.logo_url||null, logo_source:r.logo_source||null, logo_verified:Boolean(r.logo_verified), created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-expenses': {
    table: 'expenses',
    fromDb: r => ({ ...r, date:r.expense_date||r.date, payment_method:r.payment_type||r.payment_method, type:r.category||r.type }),
    toDb: r => ({ id:r.id||id(), expense_date:r.expense_date||r.date||new Date().toISOString().slice(0,10), name:text(r.name||r.description||r.category)||'Expense', vendor:text(r.vendor), category:r.type||r.category||'Other', payment_type:r.payment_type||r.payment_method||r.method||'Cash', check_number:text(r.check_number||r.reference), amount:money(r.amount||r.total), notes:text(r.notes||r.description), recurring:Boolean(r.recurring), status:r.status||null, created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-payroll-groups': {
    table:'payroll_groups',
    fromDb:r=>({ ...r, memberIds:r.member_ids||[], payment_method:r.method||'Cash', type:r.group_type||r.type||'Kitchen' }),
    toDb:r=>({ id:r.id||id(), name:text(r.name)||'Payroll group', method:r.payment_method||r.method||'Cash', notes:text(r.notes), member_ids:r.memberIds||r.member_ids||[], group_type:r.type||r.group_type||null, created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-payroll': {
    table:'payroll_entries',
    fromDb:r=>({ ...r, employee:r.employee_name, date:r.payroll_date, base_pay:money(r.regular_pay), original_tips:money(r.original_tips ?? (money(r.tips_after_withheld)+money(r.tips_withheld))), tips_after_withholding:money(r.tips_after_withheld), payment_method:r.method||'Cash', final_pay:money(r.total), total_pay:money(r.total), week_start:r.week_start||'', week_end:r.week_end||'', payroll_week_start:r.week_start||'', payroll_week_end:r.week_end||'', payment_status:r.payment_status||'Ready' }),
    toDb:r=>{ const grossTips=money(r.original_tips??r.credit_card_tips); const tipsWithheld=money(grossTips*0.035); const netTips=money(grossTips-tipsWithheld); return ({ id:r.id||id(), employee_id:r.employee_id||null, employee_name:text(r.employee_name||r.employee)||'Unknown employee', source:r.source||r.source_type||r.group_name||'Manual', pay_type:r.pay_type||'Hourly', method:r.payment_method||r.method||'Cash', check_number:text(r.check_number), payroll_date:r.payroll_date||r.date||new Date().toISOString().slice(0,10), hours:money(r.hours), regular_pay:money(r.regular_pay??r.base_pay), original_tips:grossTips, tips_after_withheld:netTips, tips_withheld:tipsWithheld, extra_pay:money(r.extra_pay), extra_reason:text(r.extra_reason), total:money(r.total_pay??r.final_pay??r.total), group_id:r.group_id||null, group_name:text(r.group_name), week_start:r.week_start||r.payroll_week_start||null, week_end:r.week_end||r.payroll_week_end||null, payment_status:r.payment_status||null, payment_date:r.payment_date||null, ach_reference:text(r.ach_reference), payment_notes:text(r.payment_notes||r.notes), source_ids:Array.isArray(r.source_ids)?r.source_ids:[], rolled_up:Boolean(r.rolled_up), weekly_rollup:Boolean(r.weekly_rollup), created_at:r.created_at||now(), updated_at:now() }) }
  },
  'restapay.sales': {
    table:'sales_days',
    fromDb:r=>({ ...r, date:r.business_date||r.date, amount:money(r.net_sales), tips_collected:money(r.tips_collected??r.tips), payment:'Mixed', category:'Food + Alcohol' }),
    toDb:r=>({ id:r.id||id(), business_date:r.business_date||r.date||new Date().toISOString().slice(0,10), gross_sales:money(r.gross_sales??r.amount), net_sales:money(r.net_sales??r.amount), cash_sales:money(r.cash_sales), credit_sales:money(r.credit_sales), gift_card_sales:money(r.gift_card_sales), online_orders:money(r.online_orders), delivery_orders:money(r.delivery_orders), pickup_orders:money(r.pickup_orders), tips:money(r.tips??r.tips_collected), tips_collected:money(r.tips_collected??r.tips), tips_withheld:money(r.tips_withheld), tips_after_withholding:money(r.tips_after_withholding), food_sales:money(r.food_sales), alcohol_sales:money(r.alcohol_sales), other_sales:money(r.other_sales), excluded_sales:money(r.excluded_sales), food_sales_categories:Array.isArray(r.food_sales_categories)?r.food_sales_categories:[], alcohol_sales_categories:Array.isArray(r.alcohol_sales_categories)?r.alcohol_sales_categories:[], other_sales_categories:Array.isArray(r.other_sales_categories)?r.other_sales_categories:[], excluded_sales_categories:Array.isArray(r.excluded_sales_categories)?r.excluded_sales_categories:[], refunds:money(r.refunds), voids:money(r.voids), discounts:money(r.discounts), tax:money(r.tax), guest_count:money(r.guest_count), source_file:text(r.source_file), import_note:text(r.import_note), created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-bank-checks': {
    table:'bank_checks',
    fromDb:r=>({ ...r, date:r.payment_date||r.date, type:r.payment_type||r.type, reference:r.reference_number||r.reference }),
    toDb:r=>({ id:r.id||id(), payment_date:r.payment_date||r.date||new Date().toISOString().slice(0,10), payment_type:r.payment_type||r.type||'Check', payee:text(r.payee), reference_number:text(r.reference_number||r.reference), amount:money(r.amount), status:r.status||'Pending', notes:text(r.notes), created_at:r.created_at||now(), updated_at:now() })
  }
}

const OPTIONAL_TABLE_KEYS = new Set(['restapay-bank-checks'])
const isMissingTableError = error => error && (error.code === '42P01' || error.status === 404 || /does not exist|not found|schema cache/i.test(String(error.message || '')))
const normalizeCollectionRows = (rows, key) => (Array.isArray(rows) ? rows : []).filter(Boolean).map(row => {
  const normalized = { ...row }
  if (key === 'restapay-employees') {
    normalized.name = text(normalized.name || normalized.employee_name) || 'Unnamed employee'
    normalized.job = text(normalized.job || normalized.job_type) || 'Kitchen'
    normalized.type = text(normalized.type || normalized.employee_type) || 'Hourly'
    normalized.method = text(normalized.method || normalized.pay_method) || 'Cash'
    normalized.status = text(normalized.status) || 'Active'
  }
  if (key === 'restapay-vendors') {
    normalized.name = text(normalized.name || normalized.vendor_name) || 'Unnamed vendor'
    normalized.type = text(normalized.type || normalized.vendor_type) || 'Operating Expense'
    normalized.category = text(normalized.category) || 'Other'
    normalized.expenseType = text(normalized.expenseType || normalized.expense_type) || 'Other'
    normalized.status = text(normalized.status) || 'Active'
  }
  if (key === 'restapay-bank-checks') normalized.status = text(normalized.status) || 'Pending'
  return normalized
})

const cache = new Map(Object.keys(configs).map(k=>[k,[]]))
const ready = new Map()
const listeners = new Set()

function emit(key){ window.dispatchEvent(new CustomEvent('restapay:data-change',{detail:{key,source:'supabase'}})); listeners.forEach(fn=>fn()) }
export const isLiveKey = key => Boolean(configs[key])
export const getLiveCollection = key => cache.get(key) || []
export const subscribeLiveData = fn => { listeners.add(fn); return ()=>listeners.delete(fn) }

async function loadInvoices(){
  const [{data:invoices,error:e1},{data:items,error:e2},{data:vendors,error:e3}] = await Promise.all([
    supabase.from('invoices').select('*').order('invoice_date',{ascending:false}),
    supabase.from('invoice_items').select('*'),
    supabase.from('vendors').select('id,name')
  ])
  if(e1) throw e1
  if(e2) console.warn('Invoice headers loaded but invoice items could not be read.', e2)
  if(e3) console.warn('Invoice vendor names could not be joined.', e3)
  const vendorNames = new Map((vendors||[]).map(v=>[String(v.id),v.name]))
  const byInvoice = new Map()
  ;(items||[]).forEach(item=>{const list=byInvoice.get(String(item.invoice_id))||[];list.push({...item,description:item.description||item.item_name||item.name,quantity:money(item.quantity??item.qty),unit_price:money(item.unit_price??item.price??item.cost),line_total:money(item.line_total??item.total??item.amount)});byInvoice.set(String(item.invoice_id),list)})
  return (invoices||[]).map(r=>({
    ...r,
    date:r.invoice_date||r.date||r.created_at?.slice?.(0,10)||'',
    vendor:r.vendor_name||vendorNames.get(String(r.vendor_id))||r.vendor||'Unassigned vendor',
    number:r.invoice_number||r.number||r.reference||String(r.id||'').slice(0,8),
    payment_type:r.payment_type||r.method||'Check',
    total:money(r.total??r.amount??r.invoice_total),
    lines:byInvoice.get(String(r.id))||[]
  }))
}
async function saveInvoices(rows){
  const invoiceRows=(rows||[]).map(r=>({id:r.id||id(),vendor_id:r.vendor_id||null,vendor_name:text(r.vendor||r.vendor_name),invoice_number:text(r.number||r.invoice_number),invoice_date:r.date||r.invoice_date||new Date().toISOString().slice(0,10),due_date:r.due_date||null,category:r.category||'Other',payment_type:r.payment_type||'Check',check_number:text(r.check_number),invoice_type:r.invoice_type||'Regular Invoice',subtotal:money(r.subtotal),tax:money(r.tax),total:money(r.total||r.amount),status:r.status||'Due',source_file:text(r.source_file),notes:text(r.notes),duplicate_override:Boolean(r.duplicate_override),duplicate_match_id:r.duplicate_match_id||null,duplicate_match_reason:text(r.duplicate_match_reason),created_at:r.created_at||now(),updated_at:now()}))
  await syncExact('invoices',invoiceRows)
  const ids=new Set(invoiceRows.map(r=>r.id)); const lines=(rows||[]).flatMap(r=>(r.lines||[]).map(line=>({id:line.id||id(),invoice_id:r.id,description:text(line.description||line.item_name),item_name:text(line.item_name||line.description),quantity:money(line.quantity||1),unit:text(line.unit),item_number:text(line.item_number),brand:text(line.brand),package_size:text(line.package_size),pack_count:money(line.pack_count),unit_size_value:money(line.unit_size_value),unit_size_unit:text(line.unit_size_unit),normalized_unit:text(line.normalized_unit),normalized_unit_cost:money(line.normalized_unit_cost),unit_price:money(line.unit_price),line_total:money(line.line_total),category:line.category||r.category||'Other',created_at:line.created_at||now()}))).filter(l=>ids.has(l.invoice_id))
  await syncExact('invoice_items',lines)
}

async function syncExact(table,rows){
  const nextIds=new Set((rows||[]).map(r=>String(r.id)).filter(Boolean))
  const {data:existing,error:readError}=await supabase.from(table).select('id'); if(readError) throw readError
  const stale=(existing||[]).map(r=>String(r.id)).filter(x=>!nextIds.has(x))
  for(let i=0;i<stale.length;i+=100){const {error}=await supabase.from(table).delete().in('id',stale.slice(i,i+100));if(error)throw error}
  if(rows.length){const {error}=await supabase.from(table).upsert(rows,{onConflict:'id'});if(error)throw error}
}

export async function ensureLiveCollection(key){
  if(!isLiveKey(key)) return []
  if(ready.has(key)) return ready.get(key)
  const promise=(async()=>{
    if(!isSupabaseReady) throw new Error('Supabase environment variables are missing.')
    let rows
    if(key==='restapay-invoices') rows=await loadInvoices()
    else {const cfg=configs[key];const {data,error}=await supabase.from(cfg.table).select('*');if(error){if(OPTIONAL_TABLE_KEYS.has(key)&&isMissingTableError(error)){console.warn(`Optional Supabase table ${cfg.table} is unavailable; using an empty collection.`);rows=[]}else throw error}else rows=(data||[]).map(cfg.fromDb)}
    rows=normalizeCollectionRows(rows,key);cache.set(key,rows);emit(key);return rows
  })().catch(error=>{ready.delete(key);console.error(`Unable to load ${key}`,error);window.dispatchEvent(new CustomEvent('restapay:cloud-error',{detail:{key,message:error.message}}));throw error})
  ready.set(key,promise);return promise
}

export async function replaceLiveCollection(key,nextOrUpdater){
  await ensureLiveCollection(key)
  const current=cache.get(key)||[]
  const next=typeof nextOrUpdater==='function'?nextOrUpdater(current):nextOrUpdater
  cache.set(key,Array.isArray(next)?next:[]);emit(key)
  try{
    if(key==='restapay-invoices') await saveInvoices(cache.get(key))
    else {const cfg=configs[key];await syncExact(cfg.table,cache.get(key).map(cfg.toDb))}
    window.dispatchEvent(new CustomEvent('restapay:cloud-status',{detail:{status:'saved',key}}))
  }catch(error){console.error(`Unable to save ${key}`,error);await reloadLiveCollection(key);window.dispatchEvent(new CustomEvent('restapay:cloud-error',{detail:{key,message:error.message}}));throw error}
}
export async function reloadLiveCollection(key){ready.delete(key);return ensureLiveCollection(key)}
export async function initializeLiveData(){await Promise.allSettled(Object.keys(configs).map(ensureLiveCollection))}
export function liveSnapshot(){return {sales:getLiveCollection('restapay.sales'),payroll:getLiveCollection('restapay-payroll'),invoices:getLiveCollection('restapay-invoices'),expenses:getLiveCollection('restapay-expenses'),vendors:getLiveCollection('restapay-vendors'),employees:getLiveCollection('restapay-employees')}}
