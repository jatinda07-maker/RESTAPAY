import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileUp, RefreshCw } from 'lucide-react'
import * as XLSX from 'xlsx'
import Modal from './Modal'
import { useFeedback } from './AppFeedback'
import { parseToastSalesRows, parseToastSalesCategoryTotals, parseToastPaymentTotals } from '../core/engines/ToastSalesEngine.js'
import { parseToastLaborRows, laborImportDiagnostics } from '../core/engines/ToastLaborEngine.js'

const money = value => Number(value || 0).toLocaleString('en-US', { style:'currency', currency:'USD' })
const uid = prefix => `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`

function workbookFromArrayBuffer(buffer) {
  return XLSX.read(buffer, { type:'array', cellDates:true })
}


const norm = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const num = value => Number(String(value ?? '').replace(/[$,%(),]/g, '').trim()) || 0
function genericSalesRows(workbook, fileName) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = sheet ? XLSX.utils.sheet_to_json(sheet, { defval:'', raw:false }) : []
  const find = (row, aliases) => {
    const map = Object.fromEntries(Object.entries(row).map(([k,v]) => [norm(k), v]))
    for (const alias of aliases) if (map[norm(alias)] !== undefined) return map[norm(alias)]
    return ''
  }
  return raw.map(row => {
    const net = num(find(row, ['Net Sales','Gross Sales','Sales','Amount']))
    const cash = num(find(row, ['Cash Sales','Cash']))
    const credit = num(find(row, ['Credit Sales','Credit','Card Sales']))
    const other = num(find(row, ['Other Payments','Other Sales','Other']))
    const food = num(find(row, ['Food Sales','Food']))
    const alcohol = num(find(row, ['Alcohol Sales','Alcohol']))
    const tips = num(find(row, ['Tips','Tips Collected']))
    if (!net && !cash && !credit && !other && !food && !alcohol && !tips) return null
    const date = String(find(row, ['Business Date','Date']) || new Date().toISOString().slice(0,10))
    return {
      id:uid('sale'), business_date:date, net_sales:String(net || food + alcohol), gross_sales:String(net || food + alcohol),
      food_sales:String(food), alcohol_sales:String(alcohol), other_sales:'0', excluded_sales:'0',
      cash_sales:String(cash), credit_sales:String(credit), other_payments:String(other), gift_card_sales:'0',
      tips_collected:String(tips), tips_withheld:String(Math.round(tips * 3.5) / 100), tips:String(Math.max(0, tips - Math.round(tips * 3.5) / 100)),
      tax:String(num(find(row, ['Tax','Tax Amount']))), source_file:fileName, import_note:'Generic Toast CSV mapping'
    }
  }).filter(Boolean)
}

function salesSummary(workbook) {
  const categories = parseToastSalesCategoryTotals(XLSX, workbook)
  const payments = parseToastPaymentTotals(XLSX, workbook)
  return { categories, payments }
}

export default function ToastReportImport({ open, type = 'sales', onClose, onImport }) {
  const { notify } = useFeedback()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [details, setDetails] = useState(null)
  const [stage, setStage] = useState('choose')
  const [busy, setBusy] = useState(false)
  const [previewPage, setPreviewPage] = useState(0)

  const isSales = type === 'sales'
  const title = isSales ? 'Import Toast Sales Report' : 'Import Toast Payroll Report'
  const subtitle = isSales
    ? 'Upload the Toast Sales Summary and review sales, payments, categories, and tips before import'
    : 'Upload the Toast Labor Summary and review employees, hours, tips, and withholding before import'

  const salesReview = useMemo(() => {
    if (!isSales || !rows.length) return null
    const p = details?.payments || {}
    const c = details?.categories || {}
    const sum = field => Math.round(rows.reduce((total,row)=>total+num(row[field]),0)*100)/100
    const dates = rows.map(row=>String(row.business_date||row.date||'')).filter(Boolean).sort()
    const expected = {
      net: Math.round(((c.foodTotal||0)+(c.alcoholTotal||0)+(c.otherTotal||0)+(c.excludedTotal||0))*100)/100,
      cash: Math.round(Number(p.cash||0)*100)/100,
      credit: Math.round(Number(p.credit||0)*100)/100,
      tips: Math.round(Number(p.tips||0)*100)/100,
      food: Math.round(Number(c.foodTotal||0)*100)/100,
      alcohol: Math.round(Number(c.alcoholTotal||0)*100)/100,
    }
    const parsed = { net:sum('net_sales'), cash:sum('cash_sales'), credit:sum('credit_sales'), tips:sum('tips_collected'), food:sum('food_sales'), alcohol:sum('alcohol_sales') }
    const checks = Object.keys(expected).map(key=>({key,source:expected[key],parsed:parsed[key],ok:Math.abs(expected[key]-parsed[key])<0.011}))
    return { from:dates[0]||'', to:dates[dates.length-1]||'', expected, parsed, checks, ok:checks.every(item=>item.ok) }
  }, [rows,isSales,details])

  const summary = useMemo(() => {
    if (isSales) {
      const review = salesReview
      return [
        { label:'Daily rows', value:rows.length },
        { label:'Date range', value:review?.from && review?.to ? `${review.from} → ${review.to}` : '—' },
        { label:'Net sales', value:money(review?.parsed.net) },
        { label:'Cash', value:money(review?.parsed.cash) },
        { label:'Credit', value:money(review?.parsed.credit) },
        { label:'Tips', value:money(review?.parsed.tips) },
        { label:'Food / Alcohol', value:`${money(review?.parsed.food)} / ${money(review?.parsed.alcohol)}` },
      ]
    }
    const d = details || laborImportDiagnostics(rows)
    return [
      { label:'Payroll rows', value:rows.length },
      { label:'Employees', value:d.employeeCount ?? new Set(rows.map(r => r.employee_name)).size },
      { label:'Hours', value:Number(d.totalHours ?? rows.reduce((s,r) => s + Number(r.hours || 0), 0)).toFixed(2) },
      { label:'Gross tips', value:money(d.totalTips ?? rows.reduce((s,r) => s + Number(r.original_tips || 0), 0)) },
      { label:'Withheld', value:money(d.totalWithheld ?? rows.reduce((s,r) => s + Number(r.tip_deduction || 0), 0)) },
      { label:'Net tips', value:money(rows.reduce((s,r) => s + Number(r.tips || 0), 0)) },
    ]
  }, [rows, isSales, details, salesReview])

  const reset = () => { setFile(null); setRows([]); setDetails(null); setStage('choose'); setBusy(false); setPreviewPage(0) }
  const close = () => { reset(); onClose?.() }

  const chooseFile = async event => {
    const selected = event.target.files?.[0]
    if (!selected) return
    setBusy(true); setFile(selected); setRows([]); setDetails(null); setStage('choose'); setPreviewPage(0)
    try {
      const workbook = workbookFromArrayBuffer(await selected.arrayBuffer())
      if (isSales) {
        const parsed = parseToastSalesRows(XLSX, workbook, selected.name, uid)
        const finalRows = parsed.length ? parsed : genericSalesRows(workbook, selected.name)
        if (!finalRows.length) throw new Error('This workbook does not contain a recognizable Toast Sales category summary.')
        setRows(finalRows)
        setDetails(parsed.length ? salesSummary(workbook) : { categories:{ foodTotal:finalRows.reduce((s,r)=>s+num(r.food_sales),0), alcoholTotal:finalRows.reduce((s,r)=>s+num(r.alcohol_sales),0), otherTotal:0, excludedTotal:0 }, payments:{ cash:finalRows.reduce((s,r)=>s+num(r.cash_sales),0), credit:finalRows.reduce((s,r)=>s+num(r.credit_sales),0), other:finalRows.reduce((s,r)=>s+num(r.other_payments),0), tips:finalRows.reduce((s,r)=>s+num(r.tips_collected),0) } })
      } else {
        const parsed = parseToastLaborRows(XLSX, workbook, { fileName:selected.name, tipRate:3.5 })
          .map(row => ({ ...row, id:uid('payroll'), source:'toast', source_file:selected.name, payment_method:row.payment_method || 'Check' }))
        if (!parsed.length) throw new Error('No recognizable Toast labor or payroll rows were found.')
        setRows(parsed)
        setDetails(laborImportDiagnostics(parsed))
      }
      setStage('review')
    } catch (error) {
      notify(error?.message || 'The Toast report could not be parsed.', 'error')
    } finally { setBusy(false); event.target.value = '' }
  }

  const commit = async () => {
    if (!rows.length) return notify('No parsed records are available to import.', 'error')
    setBusy(true)
    try {
      const result = await onImport?.({ file, rows, type, details })
      const suffix = result?.savedCount ? ` ${result.savedCount} records verified.` : ''
      notify(`${file.name} imported to live RestaPay data.${suffix}`)
      close()
    } catch (error) {
      notify(error?.message || 'Import failed.', 'error')
      setBusy(false)
    }
  }

  const previewColumns = isSales
    ? ['business_date','net_sales','food_sales','alcohol_sales','cash_sales','credit_sales','tips_collected']
    : ['pay_date','employee_name','job_type','hours','regular_pay','original_tips','tip_deduction','tips']

  return <Modal open={open} title={title} subtitle={subtitle} onClose={close} size="lg" footer={stage === 'choose' ? <>
    <button className="secondary-action" onClick={close}>Cancel</button>
  </> : <>
    <button className="secondary-action" onClick={reset}><RefreshCw size={16}/>Choose Another</button>
    <button className="primary-button" disabled={busy || !rows.length || (isSales && salesReview && !salesReview.ok)} onClick={commit}><CheckCircle2 size={16}/>{busy ? 'Importing...' : `Import ${isSales ? 'Sales' : 'Payroll'}`}</button>
  </>}>
    {stage === 'choose' ? <>
      <label className="ai-dropzone toast-report-dropzone">
        <FileSpreadsheet size={34}/>
        <strong>{busy ? 'Reading Toast workbook...' : `Choose Toast ${isSales ? 'Sales Summary' : 'Labor Summary'} file`}</strong>
        <span>CSV, XLSX, and XLS are parsed by the migrated Toast engine before import.</span>
        <input type="file" accept=".csv,.xlsx,.xls" disabled={busy} onChange={chooseFile}/>
      </label>
      <div className="import-review-note"><AlertTriangle size={18}/><span>Review before importing. RestaPay will save these records to live Supabase data and verify the write before reporting success.</span></div>
    </> : <div className="toast-import-review">
      <div className="toast-import-summary">{summary.map(item => <div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>
      <div className="toast-import-validation"><CheckCircle2 size={18}/><span>{isSales && salesReview ? `Reconciliation ${salesReview.ok ? 'passed' : 'needs review'} for ${rows.length} rows (${salesReview.from} through ${salesReview.to}).` : 'Toast engine validation passed. Review the parsed records below before importing.'}</span></div>
      {isSales && salesReview && <div className="toast-import-summary">{salesReview.checks.map(item => <div key={item.key}><small>{item.key.replaceAll('_',' ')}</small><strong>{money(item.parsed)}</strong><span style={{fontSize:12}}>{item.ok ? '✓ matches source' : `Source ${money(item.source)}`}</span></div>)}</div>}
      {isSales && <p className="toast-import-more">Daily Net Sales come directly from Toast. This Sales Summary workbook provides report-level Food, Alcohol, Cash, Credit and Tips totals, so those fields are allocated across days and reconcile exactly to the report total.</p>}
      <div className="toast-import-preview"><table><thead><tr>{previewColumns.map(header => <th key={header}>{header.replaceAll('_',' ')}</th>)}</tr></thead>
        <tbody>{rows.slice(previewPage*10,previewPage*10+10).map((row,index) => <tr key={row.id || index}>{previewColumns.map(header => <td key={header}>{String(row[header] ?? '')}</td>)}</tr>)}</tbody></table></div>
      <div className="toast-import-more" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><span>Showing {rows.length ? previewPage*10+1 : 0}–{Math.min(rows.length,previewPage*10+10)} of {rows.length} parsed rows.</span><span style={{display:'flex',gap:8}}><button type="button" className="secondary-action" disabled={previewPage===0} onClick={()=>setPreviewPage(page=>Math.max(0,page-1))}>Previous</button><button type="button" className="secondary-action" disabled={(previewPage+1)*10>=rows.length} onClick={()=>setPreviewPage(page=>page+1)}>Next</button></span></div>
    </div>}
  </Modal>
}
