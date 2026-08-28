import { isSupabaseReady, supabase } from '../lib/supabase.js'

const now = () => new Date().toISOString()
const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
const money = value => Number(String(value ?? 0).replace(/[$,%(),]/g, '')) || 0
const truncateMoney = value => Math.trunc((money(value) + Number.EPSILON) * 100) / 100
const text = value => String(value ?? '').trim()
const normalizeJob = value => /^(server|waitress|front\s*house|front-of-house|foh)$/i.test(text(value)) ? 'Waiter' : /^dish\s*washer$/i.test(text(value)) ? 'Dishwasher' : text(value)

const CLOSING_BALANCE_MARKER = 'RESTAPAY_CLOSING_BALANCE='
const closingBalanceTarget = row => {
  const direct = row?.target_closing_balance ?? row?.closing_balance
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return money(direct)
  const textBlob = `${row?.notes || ''} ${row?.purpose || ''}`
  const match = textBlob.match(/RESTAPAY_CLOSING_BALANCE=([-+]?\d+(?:\.\d+)?)/i)
  return match ? money(match[1]) : null
}
const notesWithClosingBalanceTarget = row => {
  const base = text(row?.notes).replace(/(?:\s*\|?\s*)?RESTAPAY_CLOSING_BALANCE=[-+]?\d+(?:\.\d+)?/ig, '').trim()
  const target = closingBalanceTarget(row)
  if (target === null) return base
  return `${base}${base ? ' | ' : ''}${CLOSING_BALANCE_MARKER}${target.toFixed(2)}`
}
export const cashClosingBalanceTarget = closingBalanceTarget

const payrollIdentity = row => {
  const employee = text(row?.employee_id || row?.employee_name || row?.employee).toLowerCase()
  const date = text(row?.payroll_date || row?.pay_date || row?.date)
  const weekStart = text(row?.week_start || row?.payroll_week_start)
  const weekEnd = text(row?.week_end || row?.payroll_week_end)
  const sourceIds = Array.isArray(row?.source_ids) ? [...row.source_ids].map(String).sort().join(',') : ''
  const source = text(row?.source || row?.source_type || row?.group_name).toLowerCase()
  const method = text(row?.payment_method || row?.method).toLowerCase()
  const hours = money(row?.hours).toFixed(4)
  const regularPay = money(row?.regular_pay ?? row?.base_pay).toFixed(2)
  const tips = money(row?.original_tips ?? row?.credit_card_tips).toFixed(2)
  const extraPay = money(row?.extra_pay).toFixed(2)
  const weeklyLike = Boolean(row?.weekly_rollup || source === 'weekly-rollup' || source === 'kitchen-weekly' || (weekStart && weekEnd))
  if (weeklyLike) {
    // Kitchen history can legitimately contain a regular-pay component and a separate
    // extra-pay component from older releases. Keep distinct monetary components so
    // the historical repair can combine them; collapse only exact repeated copies.
    if (source === 'kitchen-weekly') {
      const total = money(row?.total_pay ?? row?.total).toFixed(2)
      return `weekly-component|${employee}|${weekStart}|${weekEnd}|${source}|${regularPay}|${extraPay}|${total}|${method}`
    }
    return `weekly|${employee}|${weekStart}|${weekEnd}|${source || 'weekly-rollup'}`
  }
  return `entry|${employee}|${date}|${source}|${method}|${hours}|${regularPay}|${tips}|${extraPay}`
}

const dedupePayrollRows = rows => {
  const seen = new Map()
  ;(Array.isArray(rows) ? rows : []).filter(Boolean).forEach(row => {
    const key = payrollIdentity(row)
    const existing = seen.get(key)
    if (!existing) { seen.set(key, row); return }
    const existingUpdated = text(existing.updated_at || existing.paid_at || existing.created_at)
    const rowUpdated = text(row.updated_at || row.paid_at || row.created_at)
    if (rowUpdated >= existingUpdated) seen.set(key, row)
  })
  return [...seen.values()]
}

const configs = {
  'restapay-invoices': { table: 'invoices' },
  'restapay-employees': {
    table: 'employees',
    fromDb: r => ({
      ...r,
      job: normalizeJob(r.job_type || r.job || 'Other'),
      job_type: normalizeJob(r.job_type || r.job || 'Other'),
      type: r.employee_type || r.type || 'Regular',
      method: r.payroll_type || r.method || 'Cash',
      basePay: money(r.base_pay ?? r.basePay),
      status: r.active === false ? 'Inactive' : 'Active',
      is_active: r.active !== false
    }),
    toDb: r => ({ id:r.id||id(), name:text(r.name)||'Unnamed employee', employee_type:r.employee_type||r.type||'Regular', job_type:normalizeJob(r.job_type||r.job||'Other'), pay_type:r.pay_type||'Hourly', payroll_type:r.payroll_type||r.method||'Cash', default_check_number:text(r.default_check_number||r.check_number), base_pay:money(r.base_pay ?? r.basePay), extra_pay:money(r.extra_pay), extra_reason:text(r.extra_reason), active:r.status ? String(r.status).toLowerCase() !== 'inactive' : (r.is_active!==false&&r.active!==false), phone:text(r.phone), email:text(r.email), notes:text(r.notes), created_at:r.created_at||now(), updated_at:now() })
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
  'restapay-pay-rates': {
    table:'employee_pay_rates',
    fromDb:r=>({ ...r, employee_id:String(r.employee_id||''), amount:money(r.amount), effective_date:text(r.effective_date), reason:text(r.reason) }),
    toDb:r=>({ id:r.id||id(), employee_id:String(r.employee_id||''), amount:money(r.amount), effective_date:text(r.effective_date)||new Date().toISOString().slice(0,10), reason:text(r.reason), created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-payroll-groups': {
    table:'payroll_groups',
    fromDb:r=>({ ...r, memberIds:r.member_ids||[], payment_method:r.method||'Cash', type:r.group_type||r.type||'Kitchen' }),
    toDb:r=>({ id:r.id||id(), name:text(r.name)||'Payroll group', method:r.payment_method||r.method||'Cash', notes:text(r.notes), member_ids:r.memberIds||r.member_ids||[], group_type:r.type||r.group_type||null, created_at:r.created_at||now(), updated_at:now() })
  },
  'restapay-payroll': {
    table:'payroll_entries',
    fromDb:r=>({ ...r, employee:r.employee_name, job_type:normalizeJob(r.job_type||r.job||''), labor_classification:text(r.labor_classification||r.payroll_classification||''), department:text(r.department||''), date:r.payroll_date, base_pay:money(r.regular_pay), original_tips:money(r.original_tips ?? (money(r.tips_after_withheld)+money(r.tips_withheld))), credit_card_tips:money(r.original_tips ?? (money(r.tips_after_withheld)+money(r.tips_withheld))), tip_deduction:money(r.tips_withheld), tips_withheld:money(r.tips_withheld), tips_after_withholding:money(r.tips_after_withheld), tips_after_withheld:money(r.tips_after_withheld), payment_method:r.method||'Cash', final_pay:money(r.total), total_pay:money(r.total), week_start:r.week_start||'', week_end:r.week_end||'', payroll_week_start:r.week_start||'', payroll_week_end:r.week_end||'', payment_status:r.payment_status||(r.weekly_rollup?'Unpaid':'Source') }),
    toDb:r=>{ const grossTips=money(r.original_tips??r.credit_card_tips); const tipsWithheld=money(grossTips*0.035); const netTips=truncateMoney(grossTips-tipsWithheld); return ({ id:r.id||id(), employee_id:r.employee_id||null, employee_name:text(r.employee_name||r.employee)||'Unknown employee', source:r.source||r.source_type||r.group_name||'Manual', pay_type:r.pay_type||'Hourly', method:r.payment_method||r.method||'Cash', check_number:text(r.check_number), payroll_date:r.payroll_date||r.date||new Date().toISOString().slice(0,10), job_type:normalizeJob(r.job_type||r.job||r.position||r.role||''), labor_classification:text(r.labor_classification||r.payroll_classification||r.classification||''), department:text(r.department||''), hours:money(r.hours), regular_pay:money(r.regular_pay??r.base_pay), original_tips:grossTips, tips_after_withheld:netTips, tips_withheld:tipsWithheld, extra_pay:money(r.extra_pay), extra_reason:text(r.extra_reason), total:truncateMoney(r.total_pay??r.final_pay??r.total), group_id:r.group_id||null, group_name:text(r.group_name), week_start:r.week_start||r.payroll_week_start||null, week_end:r.week_end||r.payroll_week_end||null, payment_status:r.payment_status||null, payment_date:r.payment_date||null, ach_reference:text(r.ach_reference), payment_notes:text(r.payment_notes||r.notes), source_ids:Array.isArray(r.source_ids)?r.source_ids:[], rolled_up:Boolean(r.rolled_up), weekly_rollup:Boolean(r.weekly_rollup), created_at:r.created_at||now(), updated_at:now() }) }
  },
  'restapay.sales': {
    table:'sales_days',
    fromDb:r=>({ ...r, date:r.business_date||r.date, amount:money(r.net_sales), tips_collected:money(r.tips_collected??r.tips), payment:'Mixed', category:'Food + Alcohol' }),
    toDb:r=>({ id:r.id||id(), business_date:r.business_date||r.date||new Date().toISOString().slice(0,10), gross_sales:money(r.gross_sales??r.amount), net_sales:money(r.net_sales??r.amount), cash_sales:money(r.cash_sales), credit_sales:money(r.credit_sales), gift_card_sales:money(r.gift_card_sales), online_orders:money(r.online_orders), delivery_orders:money(r.delivery_orders), pickup_orders:money(r.pickup_orders), tips:money(r.tips??r.tips_collected), tips_collected:money(r.tips_collected??r.tips), tips_withheld:money(r.tips_withheld), tips_after_withholding:money(r.tips_after_withholding), food_sales:money(r.food_sales), alcohol_sales:money(r.alcohol_sales), other_sales:money(r.other_sales), excluded_sales:money(r.excluded_sales), food_sales_categories:Array.isArray(r.food_sales_categories)?r.food_sales_categories:[], alcohol_sales_categories:Array.isArray(r.alcohol_sales_categories)?r.alcohol_sales_categories:[], other_sales_categories:Array.isArray(r.other_sales_categories)?r.other_sales_categories:[], excluded_sales_categories:Array.isArray(r.excluded_sales_categories)?r.excluded_sales_categories:[], refunds:money(r.refunds), voids:money(r.voids), discounts:money(r.discounts), tax:money(r.tax), guest_count:money(r.guest_count), source_file:text(r.source_file), import_note:text(r.import_note), created_at:r.created_at||now(), updated_at:now() })
  },

  'restapay-invoice-approvals': {
    table:'invoice_edit_requests',
    fromDb:r=>({...r,original:r.original_invoice||{},proposed:r.proposed_invoice||{},requestedBy:r.requested_by_email||''}),
    toDb:r=>({id:r.id||id(),invoice_id:r.invoice_id||r.invoiceId,status:r.status||'Pending',requested_by:r.requested_by||null,requested_by_email:text(r.requested_by_email||r.requestedBy),original_invoice:r.original_invoice||r.original||{},proposed_invoice:r.proposed_invoice||r.proposed||{},decision_notes:text(r.decision_notes),decided_by:r.decided_by||null,decided_at:r.decided_at||null,created_at:r.created_at||now(),updated_at:now()})
  },
  'restapay-cash-ledger': {
    table:'cash_ledger',
    fromDb:r=>{ const target=closingBalanceTarget(r); return {...r,date:r.entry_date||r.date,type:r.entry_type||r.type,...(target===null?{}:{target_closing_balance:target})} },
    // cash_ledger has no dedicated closing-balance target column in older production schemas.
    // Persist the authoritative target in notes so a Supabase reload can reconstruct it.
    toDb:r=>({id:r.id||id(),entry_date:r.entry_date||r.date||new Date().toISOString().slice(0,10),entry_type:r.entry_type||r.type||'withdrawal',amount:money(r.amount),purpose:text(r.purpose),notes:notesWithClosingBalanceTarget(r),created_by:r.created_by||null,created_by_email:text(r.created_by_email),created_at:r.created_at||now(),updated_at:now()})
  },
  'restapay-bank-checks': {
    table:'bank_checks',
    fromDb:r=>({ ...r, date:r.payment_date||r.date, type:r.payment_type||r.type, reference:r.reference_number||r.reference }),
    toDb:r=>({ id:r.id||id(), payment_date:r.payment_date||r.date||new Date().toISOString().slice(0,10), payment_type:r.payment_type||r.type||'Check', payee:text(r.payee), reference_number:text(r.reference_number||r.reference), amount:money(r.amount), status:r.status||'Pending', notes:text(r.notes), created_at:r.created_at||now(), updated_at:now() })
  }
}

const LIVE_SETTING_KEYS = new Set(['restapay-cost-settings','restapay-expense-types-v2','restapay-categories','restapay-labor-classification','restapay-manager-access','restapay-admin-dashboard'])
const settingCache = new Map()
const settingReady = new Map()
export const isLiveSettingKey = key => LIVE_SETTING_KEYS.has(key)
export const getLiveSetting = (key, fallback) => settingCache.has(key) ? settingCache.get(key) : fallback

const OPTIONAL_TABLE_KEYS = new Set(['restapay-bank-checks','restapay-invoice-approvals','restapay-cash-ledger'])
const isMissingTableError = error => error && (error.code === '42P01' || error.status === 404 || /does not exist|not found|schema cache/i.test(String(error.message || '')))
const normalizeCollectionRows = (rows, key) => (Array.isArray(rows) ? rows : []).filter(Boolean).map(row => {
  const normalized = { ...row }
  if (key === 'restapay-employees') {
    normalized.name = text(normalized.name || normalized.employee_name) || 'Unnamed employee'
    normalized.job = normalizeJob(normalized.job || normalized.job_type) || 'Kitchen'
    normalized.job_type = normalized.job
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
let realtimeChannel = null
let realtimeConnectPromise = null
let invoiceReloadTimer = null
let lastReconcileAt = 0

function emit(key, source='supabase'){
  const detail={key,source,at:Date.now()}
  window.dispatchEvent(new CustomEvent('restapay:data-change',{detail}))
  window.dispatchEvent(new CustomEvent('restapay:derived-data-invalidated',{detail}))
  listeners.forEach(fn=>fn(detail))
}
function cloudStatus(status,key,message=''){ if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent('restapay:cloud-status',{detail:{status,key,message}})) }
function cloudError(key,error){ if(typeof window!=='undefined') window.dispatchEvent(new CustomEvent('restapay:cloud-error',{detail:{key,message:error?.message||String(error||'Unknown Supabase error')}})) }
function mergeRealtimeRow(key,payload){
  if(!isLiveKey(key)) return
  if(key==='restapay-invoices'){
    clearTimeout(invoiceReloadTimer)
    invoiceReloadTimer=setTimeout(()=>reloadLiveCollection('restapay-invoices').catch(()=>{}),120)
    return
  }
  const cfg=configs[key]
  const current=cache.get(key)||[]
  if(payload.eventType==='DELETE'){
    const targetId=String(payload.old?.id||'')
    if(!targetId) return
    cache.set(key,current.filter(row=>String(row?.id)!==targetId))
  }else{
    const raw=payload.new||{}
    const mapped=normalizeCollectionRows([cfg.fromDb?cfg.fromDb(raw):raw],key)[0]
    if(!mapped) return
    const targetId=String(mapped.id||raw.id||'')
    const next=current.filter(row=>String(row?.id)!==targetId)
    next.push(mapped)
    cache.set(key,key==='restapay-payroll'?dedupePayrollRows(next):next)
  }
  emit(key,'realtime')
}
export const isLiveKey = key => Boolean(configs[key])
export const getLiveCollection = key => cache.get(key) || []
export const subscribeLiveData = fn => { listeners.add(fn); return ()=>listeners.delete(fn) }
export async function ensureLiveSetting(key, fallback){
  if(!isLiveSettingKey(key)) return fallback
  if(settingReady.has(key)) return settingReady.get(key)
  const promise=(async()=>{
    if(!isSupabaseReady) throw new Error('Supabase environment variables are missing.')
    const {data,error}=await supabase.from('app_settings').select('setting_key,value').eq('setting_key',key).maybeSingle()
    if(error && !isMissingTableError(error)) throw error
    if(data){ settingCache.set(key,data.value); emit(key,'supabase'); return data.value }
    settingCache.set(key,fallback)
    if(!error){
      const {error:writeError}=await supabase.from('app_settings').upsert({setting_key:key,value:fallback,updated_at:now()},{onConflict:'setting_key'})
      if(writeError) throw writeError
    }
    emit(key,'supabase'); return fallback
  })().catch(error=>{settingReady.delete(key);cloudError(key,error);throw error})
  settingReady.set(key,promise);return promise
}
export async function replaceLiveSetting(key,nextOrUpdater,fallback){
  await ensureLiveSetting(key,fallback)
  const current=getLiveSetting(key,fallback)
  const next=typeof nextOrUpdater==='function'?nextOrUpdater(current):nextOrUpdater
  const role=typeof localStorage!=='undefined'?(localStorage.getItem('restapay-current-role')||'admin'):'admin'
  if(role==='manager') throw new Error('Manager role is not permitted to modify application settings.')
  settingCache.set(key,next);emit(key,'optimistic');cloudStatus('saving',key)
  try{
    const {error}=await supabase.from('app_settings').upsert({setting_key:key,value:next,updated_at:now()},{onConflict:'setting_key'})
    if(error) throw error
    cloudStatus('saved',key);return next
  }catch(error){settingCache.set(key,current);emit(key,'rollback');cloudError(key,error);throw error}
}


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
  // Keep duplicate detection/override metadata in the application row, but only persist
  // columns that exist in the baseline invoices schema. Older deployed projects may not
  // have the Phase 3D.2 duplicate_* columns yet; sending them makes PostgREST reject
  // the entire manual invoice save with a schema-cache error.
  const invoiceRows=(rows||[]).map(r=>({id:r.id||id(),vendor_id:r.vendor_id||null,vendor_name:text(r.vendor||r.vendor_name),invoice_number:text(r.number||r.invoice_number),invoice_date:r.date||r.invoice_date||new Date().toISOString().slice(0,10),due_date:r.due_date||null,payment_terms:text(r.payment_terms),category:r.category||'Other',payment_type:r.payment_type||'Check',check_number:text(r.check_number),invoice_type:r.invoice_type||'Regular Invoice',subtotal:money(r.subtotal),printed_subtotal:money(r.printed_subtotal),discount:money(r.discount),charges:money(r.charges),tax:money(r.tax),printed_total:money(r.printed_total),total:money(r.total||r.amount),status:r.status||'Due',source_file:text(r.source_file),notes:text(r.notes),created_at:r.created_at||now(),updated_at:now()}))
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

async function syncRowDiff(key,currentRows,nextRows){
  const cfg=configs[key]
  const currentById=new Map((currentRows||[]).filter(r=>r?.id).map(r=>[String(r.id),r]))
  const nextById=new Map((nextRows||[]).filter(r=>r?.id).map(r=>[String(r.id),r]))
  const removed=[...currentById.keys()].filter(rowId=>!nextById.has(rowId))
  const changed=[]
  for(const [rowId,row] of nextById){
    const previous=currentById.get(rowId)
    if(!previous || JSON.stringify(previous)!==JSON.stringify(row)) changed.push(cfg.toDb?cfg.toDb(row):row)
  }
  if(removed.length){
    for(let i=0;i<removed.length;i+=100){
      const {error}=await supabase.from(cfg.table).delete().in('id',removed.slice(i,i+100))
      if(error) throw error
    }
  }
  if(changed.length){
    const {error}=await supabase.from(cfg.table).upsert(changed,{onConflict:'id'})
    if(error) throw error
  }
}

export async function ensureLiveCollection(key){
  if(!isLiveKey(key)) return []
  if(ready.has(key)) return ready.get(key)
  const promise=(async()=>{
    if(!isSupabaseReady) throw new Error('Supabase environment variables are missing.')
    let rows
    if(key==='restapay-invoices') rows=await loadInvoices()
    else {const cfg=configs[key];const {data,error}=await supabase.from(cfg.table).select('*');if(error){if(OPTIONAL_TABLE_KEYS.has(key)&&isMissingTableError(error)){console.warn(`Optional Supabase table ${cfg.table} is unavailable; using an empty collection.`);rows=[]}else throw error}else rows=(data||[]).map(cfg.fromDb)}
    rows=normalizeCollectionRows(rows,key);
    if(key==='restapay-payroll'){
      const before=rows
      rows=dedupePayrollRows(rows)
      const keepIds=new Set(rows.map(r=>String(r.id)))
      const duplicateIds=before.map(r=>String(r.id)).filter(Boolean).filter(id=>!keepIds.has(id))
      if(duplicateIds.length){
        for(let i=0;i<duplicateIds.length;i+=100){
          const {error:cleanupError}=await supabase.from('payroll_entries').delete().in('id',duplicateIds.slice(i,i+100))
          if(cleanupError) console.warn('Historical payroll duplicate cleanup could not remove every duplicate.', cleanupError)
        }
      }
    }
    cache.set(key,rows);emit(key);return rows
  })().catch(error=>{ready.delete(key);console.error(`Unable to load ${key}`,error);window.dispatchEvent(new CustomEvent('restapay:cloud-error',{detail:{key,message:error.message}}));throw error})
  ready.set(key,promise);return promise
}


async function syncPayrollCollection(currentRows,nextRows){
  const current = dedupePayrollRows(currentRows)
  const next = dedupePayrollRows(nextRows)
  const nextIds = new Set(next.map(r=>String(r.id)).filter(Boolean))
  const removedIds = current.map(r=>String(r.id)).filter(Boolean).filter(id=>!nextIds.has(id))
  if(removedIds.length){
    for(let i=0;i<removedIds.length;i+=100){
      const {error}=await supabase.from('payroll_entries').delete().in('id',removedIds.slice(i,i+100))
      if(error) throw error
    }
  }
  if(next.length){
    const payload = next.map(configs['restapay-payroll'].toDb)
    const {error}=await supabase.from('payroll_entries').upsert(payload,{onConflict:'id'})
    if(error) throw error
  }
  return next
}

export async function replaceLiveCollection(key,nextOrUpdater){
  await ensureLiveCollection(key)
  const current=cache.get(key)||[]
  let next=typeof nextOrUpdater==='function'?nextOrUpdater(current):nextOrUpdater
  if(key==='restapay-payroll') next=dedupePayrollRows(next)
  const role=typeof localStorage!=='undefined'?(localStorage.getItem('restapay-current-role')||'admin'):'admin'
  if(role==='manager'){
    const allowed=new Set(['restapay-invoices','restapay-invoice-approvals','restapay.sales'])
    if(!allowed.has(key)) throw new Error('Manager role is not permitted to modify this data.')
    if(key==='restapay-invoices'){
      const before=new Map((current||[]).map(row=>[String(row.id),JSON.stringify(row)]))
      const changedExisting=(next||[]).some(row=>before.has(String(row.id))&&before.get(String(row.id))!==JSON.stringify(row))
      const removedExisting=(current||[]).some(row=>!(next||[]).some(candidate=>String(candidate.id)===String(row.id)))
      if(changedExisting||removedExisting) throw new Error('Manager edits to existing invoices must be submitted through Admin Approval.')
    }
  }
  cache.set(key,Array.isArray(next)?next:[]);emit(key,'optimistic')
  cloudStatus('saving',key)
  try{
    if(key==='restapay-invoices') await saveInvoices(cache.get(key))
    else if(key==='restapay-payroll') { const synced=await syncPayrollCollection(current,cache.get(key)); cache.set(key,synced) }
    else await syncRowDiff(key,current,cache.get(key))
    emit(key,'saved')
    cloudStatus('saved',key)
  }catch(error){
    console.error(`Unable to save ${key}`,error)
    cache.set(key,current);emit(key,'rollback')
    cloudError(key,error)
    throw error
  }
}
export async function reloadLiveCollection(key){ready.delete(key);return ensureLiveCollection(key)}

export async function connectLiveData(){
  if(!isSupabaseReady || realtimeChannel) return realtimeChannel
  if(realtimeConnectPromise) return realtimeConnectPromise
  realtimeConnectPromise=(async()=>{
    await initializeLiveData()
    const tableKeys=new Map()
    Object.entries(configs).forEach(([key,cfg])=>{ if(cfg?.table) tableKeys.set(cfg.table,key) })
    let channel=supabase.channel('restapay-live-data',{config:{broadcast:{self:false}}})
    const subscribedTables=new Set()
    for(const [table,key] of tableKeys){
      if(subscribedTables.has(table)) continue
      subscribedTables.add(table)
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table},payload=>mergeRealtimeRow(key,payload))
    }
    channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'app_settings'},payload=>{
      const key=String(payload.new?.setting_key||payload.old?.setting_key||'')
      if(!isLiveSettingKey(key)) return
      if(payload.eventType==='DELETE') settingCache.delete(key)
      else settingCache.set(key,payload.new?.value)
      emit(key,'realtime')
    })
    channel=channel.on('postgres_changes',{event:'*',schema:'public',table:'invoice_items'},()=>{
      clearTimeout(invoiceReloadTimer)
      invoiceReloadTimer=setTimeout(()=>reloadLiveCollection('restapay-invoices').catch(()=>{}),120)
    })
    realtimeChannel=channel.subscribe(status=>{
      if(status==='SUBSCRIBED') cloudStatus('live','all')
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT') cloudError('realtime',new Error(`Supabase realtime ${status.toLowerCase().replace('_',' ')}`))
    })
    return realtimeChannel
  })().finally(()=>{realtimeConnectPromise=null})
  return realtimeConnectPromise
}

export async function reconcileLiveData({force=false}={}){
  const currentTime=Date.now()
  if(!force && currentTime-lastReconcileAt<60000) return
  lastReconcileAt=currentTime
  await Promise.allSettled([ ...Object.keys(configs).map(reloadLiveCollection), ...[...LIVE_SETTING_KEYS].filter(key=>settingReady.has(key)||settingCache.has(key)).map(key=>{settingReady.delete(key);return ensureLiveSetting(key,settingCache.get(key))}) ])
}

export async function initializeLiveData(){await Promise.allSettled(Object.keys(configs).map(ensureLiveCollection))}
export function liveSnapshot(){return {sales:getLiveCollection('restapay.sales'),payroll:getLiveCollection('restapay-payroll'),invoices:getLiveCollection('restapay-invoices'),expenses:getLiveCollection('restapay-expenses'),vendors:getLiveCollection('restapay-vendors'),employees:getLiveCollection('restapay-employees'),payRates:getLiveCollection('restapay-pay-rates'),invoiceApprovals:getLiveCollection('restapay-invoice-approvals'),cashLedger:getLiveCollection('restapay-cash-ledger')}}
