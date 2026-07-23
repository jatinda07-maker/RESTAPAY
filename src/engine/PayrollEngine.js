const num=value=>Number(String(value??'').replace(/[$,%]/g,''))||0
export const roundPayroll=value=>Math.round((num(value)+Number.EPSILON)*100)/100
export const originalTips=row=>roundPayroll(row.original_tips??row.total_tips??(num(row.tips)+num(row.tip_deduction)))
export const payrollTotal=row=>roundPayroll(num(row.regular_pay)+num(row.overtime_pay)+num(row.tips)+num(row.extra_pay))
export const payrollEntryKey=row=>[String(row.employee_id||row.employee_name||'').toLowerCase().replace(/[^a-z0-9]/g,''),String(row.pay_date||row.payroll_date||row.date||'').slice(0,10),String(row.source_file||row.source||'')].join('::')
export function groupPayrollByEmployee(rows=[]){const map=new Map();for(const row of rows){const key=String(row.employee_id||row.employee_name||'unknown');if(!map.has(key))map.set(key,{key,employee_name:row.employee_name||'Unknown employee',rows:[],total:0});const group=map.get(key);group.rows.push(row);group.total=roundPayroll(group.total+payrollTotal(row))}return[...map.values()].map(g=>({...g,rows:g.rows.sort((a,b)=>String(a.pay_date||'').localeCompare(String(b.pay_date||'')))})).sort((a,b)=>a.employee_name.localeCompare(b.employee_name))}
