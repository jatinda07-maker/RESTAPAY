const clean = value => String(value ?? '').trim()
const key = value => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '')
const number = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const raw = clean(value)
  const negative = /^\(.*\)$/.test(raw) || raw.startsWith('-')
  const parsed = Number(raw.replace(/[$,%(),]/g, ''))
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0
}
const round2 = value => Math.round((Number(value) || 0) * 100) / 100
const aliases = {
  name: ['employee','employee name','team member','team member name','staff','staff name','name','employee full name','employee display name'],
  firstName: ['first name','employee first name','team member first name'],
  lastName: ['last name','employee last name','team member last name'],
  employeeId: ['employee id','team member id','payroll id'],
  job: ['job','job title','job type','role','department','position'],
  date: ['business date','business day','shift date','date worked','work date','clock in date','payroll date','pay date','date'],
  regularHours: ['regular hours','reg hours','regular hrs','reg hrs'],
  overtimeHours: ['overtime hours','ot hours','overtime hrs','ot hrs'],
  totalHours: ['total hours','worked hours','paid hours','hours'],
  rate: ['hourly rate','pay rate','base rate','rate'],
  regularPay: ['regular pay','regular wages','wages','labor cost','hourly pay'],
  overtimePay: ['overtime pay','ot pay'],
  grossPay: ['gross pay','gross wages','total pay','pay amount','earnings'],
  totalTips: ['total tips','tips earned','tips paid','employee tips','tip amount','tips'],
  creditTips: ['credit card tips','credit tips','non cash tips','card tips','cc tips'],
  cashTips: ['cash tips','declared cash tips'],
  netTips: ['tips after withholding','tips after withheld','net tips','final tips','tips net','net tip pay'],
  withheld: ['tips withheld','tip withheld','tips withholding','withheld tips','tip deduction','tips deducted'],
  checkNumber: ['check number','check #','check no','payment number','reference number']
}
const mapRow = row => Object.fromEntries(Object.entries(row || {}).map(([k,v]) => [key(k), v]))
const get = (row, names) => {
  const map = mapRow(row)
  for (const name of names) if (map[key(name)] !== undefined && map[key(name)] !== '') return map[key(name)]
  for (const name of names) {
    const wanted = key(name)
    const found = Object.entries(map).find(([k,v]) => v !== '' && wanted.length > 3 && (k.includes(wanted) || wanted.includes(k)))
    if (found) return found[1]
  }
  return ''
}
const has = (row, names) => names.some(name => Object.prototype.hasOwnProperty.call(mapRow(row), key(name)))
function parseDate(value, fallback='') {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0,10)
  const raw = clean(value)
  if (!raw) return fallback
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(raw)) { const [y,m,d] = raw.slice(0,10).split('-'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}` }
  const match = raw.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/)
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0,10)
}
function dateTokens(value) {
  const raw = clean(value).replace(/_/g,'-'); const out=[]; let m
  const us=/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/g
  while ((m=us.exec(raw))) out.push(`${m[3].length===2?`20${m[3]}`:m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`)
  const iso=/(\d{4})-(\d{1,2})-(\d{1,2})/g
  while ((m=iso.exec(raw))) out.push(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`)
  return [...new Set(out)]
}
export function detectToastLaborPeriod(XLSX, workbook, fileName='') {
  const labeled=[]; const all=[]
  for (const name of workbook.SheetNames || []) {
    const matrix=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false}).slice(0,80)
    for (const row of matrix) {
      const line=row.map(clean).filter(Boolean).join(' | '); const dates=dateTokens(line); all.push(...dates)
      if (/date range|report range|pay period|payroll period|week ending|period start|period end|from.+to/i.test(line)) labeled.push(...dates)
    }
  }
  const workbookDates=(labeled.length?labeled:all).sort()
  const fileDates=dateTokens(fileName).sort()
  const dates=(workbookDates.length?workbookDates:fileDates)
  if (!dates.length) return {start:'',end:'',label:''}
  return {start:dates[0],end:dates[dates.length-1],label:dates[0]===dates[dates.length-1]?dates[0]:`${dates[0]} to ${dates[dates.length-1]}`}
}
const inclusiveDates=(start,end)=>{ if(!start||!end)return[]; const out=[]; const a=new Date(`${start}T12:00:00Z`),b=new Date(`${end}T12:00:00Z`); for(let d=new Date(a);d<=b;d.setUTCDate(d.getUTCDate()+1))out.push(d.toISOString().slice(0,10)); return out }
const allocate=(total,weights)=>{ const cents=Math.round(number(total)*100); const normalized=weights.map(w=>Math.max(0,number(w))); const sum=normalized.reduce((a,b)=>a+b,0); const use=sum?normalized:weights.map(()=>1); const denom=use.reduce((a,b)=>a+b,0); let used=0; return use.map((w,i)=>{ if(i===use.length-1)return(cents-used)/100; const part=Math.floor(cents*w/denom); used+=part; return part/100 }) }
function candidateRows(XLSX, workbook) {
  const result=[]
  for (const sheetName of workbook.SheetNames || []) {
    const sheet=workbook.Sheets[sheetName]; if(!sheet)continue
    const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false})
    let best=-1,score=-1
    matrix.slice(0,60).forEach((row,index)=>{ const keys=row.map(key); let s=0; if(aliases.name.some(a=>keys.includes(key(a))))s+=6; if([...aliases.totalHours,...aliases.regularHours].some(a=>keys.includes(key(a))))s+=3; if([...aliases.totalTips,...aliases.netTips].some(a=>keys.includes(key(a))))s+=3; if(aliases.date.some(a=>keys.includes(key(a))))s+=2; if(s>score){score=s;best=index} })
    if(best<0||score<6)continue
    const headers=matrix[best].map(clean)
    matrix.slice(best+1).forEach(values=>{ const row={}; headers.forEach((h,i)=>{if(h)row[h]=values[i]}); if(Object.values(row).some(v=>clean(v)))result.push({row,sheetName}) })
  }
  return result
}
export function parseToastLaborRows(XLSX, workbook, options={}) {
  const detected=detectToastLaborPeriod(XLSX,workbook,options.fileName||''); const fileDates=dateTokens(options.fileName||'').sort()
  const period=detected.start?detected:{start:fileDates[0]||'',end:fileDates[fileDates.length-1]||'',label:''}; const tipRate=number(options.tipRate??3.5)
  const parsed=candidateRows(XLSX,workbook).map(({row,sheetName})=>{
    const combinedName=[clean(get(row,aliases.firstName)),clean(get(row,aliases.lastName))].filter(Boolean).join(' '); let rawName=clean(get(row,aliases.name))||combinedName; if (/^[^,]+,\s*[^,]+$/.test(rawName)) { const parts=rawName.split(',').map(clean); rawName=`${parts[1]} ${parts[0]}`.trim() } if(!rawName||/^(total|grand total|summary|subtotal|all employees|employee total|labor total)$/i.test(rawName))return null
    const date=parseDate(get(row,aliases.date),dateTokens(sheetName)[0]||'')
    const regularHours=number(get(row,aliases.regularHours)), overtimeHours=number(get(row,aliases.overtimeHours)); const hours=round2(number(get(row,aliases.totalHours))||regularHours+overtimeHours)
    const regular=number(get(row,aliases.regularPay)), overtime=number(get(row,aliases.overtimePay)), gross=number(get(row,aliases.grossPay)); const pay=round2(gross||regular+overtime||hours*number(get(row,aliases.rate)))
    const explicitTotal=has(row,aliases.totalTips)?get(row,aliases.totalTips):''; const totalTips=round2(explicitTotal!==''?number(explicitTotal):number(get(row,aliases.creditTips))+number(get(row,aliases.cashTips)))
    const netRaw=get(row,aliases.netTips), withheldRaw=get(row,aliases.withheld); const withheld=round2(withheldRaw!==''?number(withheldRaw):netRaw!==''?Math.max(totalTips-number(netRaw),0):totalTips*tipRate/100); const net=round2(netRaw!==''?number(netRaw):totalTips-withheld)
    if(!hours&&!pay&&!totalTips&&!net)return null
    return {raw_name:rawName,employee_name:rawName,employee_external_id:clean(get(row,aliases.employeeId)),job_type:clean(get(row,aliases.job)),pay_date:date,has_business_date:Boolean(date),period_start:period.start,period_end:period.end,hours,regular_hours:round2(regularHours),overtime_hours:round2(overtimeHours),regular_pay:round2(pay-overtime),overtime_pay:round2(overtime),gross_pay:pay,total_tips:totalTips,original_tips:totalTips,tip_deduction:withheld,tips:net,has_explicit_withholding:withheldRaw!==''||netRaw!=='',check_number:clean(get(row,aliases.checkNumber)),source_sheet:sheetName}
  }).filter(Boolean)
  const dated=parsed.filter(r=>r.has_business_date); const source=dated.length?dated:parsed
  const grouped=new Map()
  for(const row of source){ const id=key(row.employee_external_id||row.employee_name); const date=row.pay_date||period.end||options.payDate||''; const groupKey=`${id}::${date}`; const cur=grouped.get(groupKey); if(!cur){grouped.set(groupKey,{...row,pay_date:date});continue} const original=round2(cur.total_tips+row.total_tips), withheld=round2(cur.tip_deduction+row.tip_deduction); grouped.set(groupKey,{...cur,hours:round2(cur.hours+row.hours),regular_pay:round2(cur.regular_pay+row.regular_pay),overtime_pay:round2(cur.overtime_pay+row.overtime_pay),gross_pay:round2(cur.gross_pay+row.gross_pay),total_tips:original,original_tips:original,tip_deduction:withheld,tips:round2(cur.tips+row.tips)}) }
  let rows=[...grouped.values()]
  if(!dated.length&&period.start&&period.end){ const dates=inclusiveDates(period.start,period.end); rows=rows.flatMap(row=>{ const weights=options.dailySalesWeights&&dates.map(d=>options.dailySalesWeights[d]||0); const hours=allocate(row.hours,weights||dates), regular=allocate(row.regular_pay,weights||dates), overtime=allocate(row.overtime_pay,weights||dates), tips=allocate(row.total_tips,weights||dates), withheld=allocate(row.tip_deduction,weights||dates), net=allocate(row.tips,weights||dates); return dates.map((date,i)=>({...row,pay_date:date,has_business_date:false,allocated_from_summary:true,allocation_method:weights?'daily-sales':'even',allocation_days:dates.length,hours:hours[i],regular_pay:regular[i],overtime_pay:overtime[i],gross_pay:round2(regular[i]+overtime[i]),total_tips:tips[i],original_tips:tips[i],tip_deduction:withheld[i],tips:net[i]})) }) }
  return rows.sort((a,b)=>String(a.pay_date).localeCompare(String(b.pay_date))||String(a.employee_name).localeCompare(String(b.employee_name)))
}
export function laborImportDiagnostics(rows=[]){return{rows:rows.length,employees:new Set(rows.map(r=>key(r.employee_external_id||r.employee_name))).size,hours:round2(rows.reduce((s,r)=>s+number(r.hours),0)),regularPay:round2(rows.reduce((s,r)=>s+number(r.regular_pay)+number(r.overtime_pay),0)),totalTips:round2(rows.reduce((s,r)=>s+number(r.total_tips),0)),netTips:round2(rows.reduce((s,r)=>s+number(r.tips),0)),withheld:round2(rows.reduce((s,r)=>s+number(r.tip_deduction),0))}}
export const ToastLaborUtils={num:number,round2,money:value=>round2(value).toFixed(2)}
