const LOG_KEY = 'restapay_diagnostics_logs_v1'
const MAX_LOGS = 1500

function safeJson(value) {
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack }
      if (typeof item === 'function') return `[Function ${item.name || 'anonymous'}]`
      return item
    }))
  } catch {
    return { value: String(value) }
  }
}

function readLogs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLogs(logs) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, MAX_LOGS))) } catch {}
  window.dispatchEvent(new CustomEvent('restapay:diagnostics-updated'))
}

export function addDiagnosticLog(level, category, message, details = {}, options = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
    level: String(level || 'info').toLowerCase(),
    category: category || 'Application',
    message: message || 'Diagnostic event',
    page: options.page || window.location?.pathname || '',
    source: options.source || '',
    details: safeJson(details),
    userAgent: navigator.userAgent,
    appVersion: options.appVersion || 'RC17'
  }
  writeLogs([entry, ...readLogs()])
  return entry
}

export const diagnosticLogger = {
  debug: (category, message, details, options) => addDiagnosticLog('debug', category, message, details, options),
  info: (category, message, details, options) => addDiagnosticLog('info', category, message, details, options),
  warn: (category, message, details, options) => addDiagnosticLog('warning', category, message, details, options),
  error: (category, message, details, options) => addDiagnosticLog('error', category, message, details, options),
  success: (category, message, details, options) => addDiagnosticLog('success', category, message, details, options)
}

export function getDiagnosticLogs() { return readLogs() }
export function clearDiagnosticLogs() { writeLogs([]) }

export function downloadDiagnosticLogs() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'RESTAPAY',
    version: 'RC17',
    browser: navigator.userAgent,
    url: window.location.href,
    logs: readLogs()
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `restapay-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function installGlobalDiagnostics() {
  if (window.__restapayDiagnosticsInstalled) return
  window.__restapayDiagnosticsInstalled = true

  const originalWarn = console.warn.bind(console)
  const originalError = console.error.bind(console)
  console.warn = (...args) => {
    originalWarn(...args)
    addDiagnosticLog('warning', 'Console', String(args[0] || 'Console warning'), { arguments: args.slice(1) })
  }
  console.error = (...args) => {
    originalError(...args)
    addDiagnosticLog('error', 'Console', String(args[0] || 'Console error'), { arguments: args.slice(1) })
  }

  window.addEventListener('error', event => {
    diagnosticLogger.error('Runtime', event.message || 'Unhandled browser error', {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
      error: event.error
    })
  })

  window.addEventListener('unhandledrejection', event => {
    diagnosticLogger.error('Runtime', 'Unhandled promise rejection', { reason: event.reason })
  })
}
