export const JOB_OPTIONS=['Kitchen','Waiter','Manager','Bartender','Busser','Dishwasher']

export const canonicalEmployeeJob=value=>{
  const raw=String(value||'').trim()
  if(!raw) return 'Kitchen'
  if(/^(server|waitress|front\s*house|front-of-house|foh)$/i.test(raw)) return 'Waiter'
  if(/^dish\s*washer$/i.test(raw)) return 'Dishwasher'
  return raw
}

export const inferredDepartmentForJob=value=>{
  const job=canonicalEmployeeJob(value)
  if(/manager|management/i.test(job)) return 'Management'
  if(/waiter|bartender|barback|host|hostess/i.test(job)) return 'Front House'
  if(/kitchen|cook|chef|prep|dishwasher|busser/i.test(job)) return 'Kitchen / BOH'
  return 'Excluded / Other'
}

export const laborGroupLabel=value=>{
  const raw=String(value||'').trim()
  if(/^FOH$/i.test(raw)) return 'Front House'
  if(/kitchen|boh/i.test(raw)) return 'Kitchen / BOH'
  if(/management/i.test(raw)) return 'Management'
  return raw||'Excluded / Other'
}
