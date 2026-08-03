import { config } from './config.js'

function dateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${map.year}${map.month}${map.day}`
}

export function candidateExportPaths() {
  const paths = []
  for (let offset = 0; offset < config.toast.lookbackDays; offset += 1) {
    const date = new Date(Date.now() - offset * 86400000)
    const day = dateInTimeZone(date, config.toast.timezone)
    paths.push(`/${config.toast.exportId}/${day}`)
    paths.push(`/${day}`)
  }
  return [...new Set(paths)]
}
