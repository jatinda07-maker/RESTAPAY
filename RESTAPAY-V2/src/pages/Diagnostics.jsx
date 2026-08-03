import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { clearDiagnosticLogs, downloadDiagnosticLogs, getDiagnosticLogs } from '../lib/diagnostics'
import { isSupabaseReady } from '../lib/supabase'

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function Diagnostics() {
  const [logs, setLogs] = useState(() => getDiagnosticLogs())
  const [level, setLevel] = useState('all')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const refresh = () => setLogs(getDiagnosticLogs())
    window.addEventListener('restapay:diagnostics-updated', refresh)
    return () => window.removeEventListener('restapay:diagnostics-updated', refresh)
  }, [])

  const categories = useMemo(() => [...new Set(logs.map(log => log.category).filter(Boolean))].sort(), [logs])
  const filtered = useMemo(() => logs.filter(log => {
    if (level !== 'all' && log.level !== level) return false
    if (category !== 'all' && log.category !== category) return false
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return `${log.message} ${log.category} ${JSON.stringify(log.details)}`.toLowerCase().includes(needle)
  }), [logs, level, category, search])

  const counts = useMemo(() => logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1
    return acc
  }, {}), [logs])

  function handleClear() {
    if (!window.confirm('Clear all diagnostic logs from this browser? Download them first if you need to share them.')) return
    clearDiagnosticLogs()
  }

  return (
    <div className="diagnostics-page page-stack">
      <section className="diagnostics-health-grid">
        <div className="diagnostic-health-card"><span className="diagnostic-icon green"><Icon name="cloud" size={20} /></span><div><small>Supabase</small><strong>{isSupabaseReady ? 'Configured' : 'Not configured'}</strong></div></div>
        <div className="diagnostic-health-card"><span className="diagnostic-icon red"><Icon name="alert" size={20} /></span><div><small>Errors</small><strong>{counts.error || 0}</strong></div></div>
        <div className="diagnostic-health-card"><span className="diagnostic-icon orange"><Icon name="alert" size={20} /></span><div><small>Warnings</small><strong>{counts.warning || 0}</strong></div></div>
        <div className="diagnostic-health-card"><span className="diagnostic-icon blue"><Icon name="history" size={20} /></span><div><small>Total Events</small><strong>{logs.length}</strong></div></div>
      </section>

      <section className="card diagnostics-toolbar-card">
        <div className="diagnostics-toolbar">
          <div className="search-field compact-search"><Icon name="search" size={17} /><input type="search" placeholder="Search logs" value={search} onChange={event => setSearch(event.target.value)} /></div>
          <select value={level} onChange={event => setLevel(event.target.value)}><option value="all">All levels</option><option value="error">Errors</option><option value="warning">Warnings</option><option value="success">Success</option><option value="info">Info</option><option value="debug">Debug</option></select>
          <select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" className="secondary-btn" onClick={downloadDiagnosticLogs}><Icon name="download" size={17} /> Download Logs</button>
          <button type="button" className="danger-outline-btn" onClick={handleClear}><Icon name="trash" size={17} /> Clear Logs</button>
        </div>
      </section>

      <section className="card diagnostics-log-card">
        <div className="section-heading"><div><h2>Application Logs</h2><p>Use these logs to diagnose imports, database saves, calculations, invoice parsing, and runtime errors.</p></div><span>{filtered.length} shown</span></div>
        <div className="diagnostics-table-wrap">
          <table className="diagnostics-table">
            <thead><tr><th>Time</th><th>Level</th><th>Category</th><th>Message</th><th>Details</th></tr></thead>
            <tbody>
              {filtered.length ? filtered.map(log => (
                <tr key={log.id}>
                  <td>{formatDate(log.timestamp)}</td>
                  <td><span className={`diagnostic-level ${log.level}`}>{log.level}</span></td>
                  <td>{log.category}</td>
                  <td>{log.message}</td>
                  <td><details><summary>View</summary><pre>{JSON.stringify(log.details, null, 2)}</pre></details></td>
                </tr>
              )) : <tr><td colSpan="5" className="empty-cell">No diagnostic events match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
