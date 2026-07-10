import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { isSupabaseReady, supabase } from '../lib/supabase'

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export default function ToastIntegration() {
<<<<<<< HEAD
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
<<<<<<< HEAD
  const [message, setMessage] = useState('Toast SFTP connector is ready for testing.')
=======
  const [message, setMessage] = useState('Toast SFTP authentication was confirmed. Waiting for the first Toast export files.')
  const [diagnostics, setDiagnostics] = useState(null)
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)

  const configured = Boolean(API_URL)
  const statusClass = useMemo(() => {
    if (!configured) return 'status-warn'
    if (status?.connected) return 'status-ok'
    return 'status-warn'
  }, [configured, status])
=======
  const [runs, setRuns] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Checking Toast automation status...')
>>>>>>> e464eb1 (RC8 Toast SFTP automation, food and alcohol costing engine, Toast integration, Supabase import history)

  async function loadStatus() {
    if (!isSupabaseReady || !supabase) {
      setMessage('Supabase is not configured in this build. The Toast worker cannot report status yet.')
      setLoading(false)
      return
    }
    setLoading(true)
    const [{ data: runRows, error: runError }, { data: fileRows, error: fileError }] = await Promise.all([
      supabase.from('toast_import_runs').select('*').order('started_at', { ascending: false }).limit(20),
      supabase.from('toast_import_files').select('*').order('imported_at', { ascending: false }).limit(50)
    ])
    if (runError || fileError) {
      setMessage(`Toast tables are not ready: ${(runError || fileError)?.message || 'Run the Toast automation migration in Supabase.'}`)
    } else {
      setRuns(runRows || [])
      setFiles(fileRows || [])
      setMessage('Toast automation status loaded from Supabase.')
    }
    setLoading(false)
  }

  useEffect(() => { loadStatus() }, [])

<<<<<<< HEAD
  async function runAction(path, startMessage) {
    setLoading(true)
    setMessage(startMessage)
    try {
      const result = await request(path, { method: 'POST', body: '{}' })
      setMessage(result.message || 'Completed successfully.')
<<<<<<< HEAD
=======
      if (path === '/api/toast/test') setDiagnostics(result)
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
      await loadStatus()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }
=======
  const latest = runs[0]
  const todayFiles = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return files.filter(file => String(file.business_date || file.imported_at || '').slice(0, 10) === today).length
  }, [files])
>>>>>>> e464eb1 (RC8 Toast SFTP automation, food and alcohol costing engine, Toast integration, Supabase import history)

  return (
    <div className="toast-integration-page">
      <section className="form-card toast-integration-hero">
        <div>
          <span className="eyebrow">Automated Data Connection</span>
          <h2>Toast SFTP Integration</h2>
          <p>Toast exports are downloaded by a secure Render cron worker, saved to Supabase, and made available to RestaPay on every computer. The private SSH key never enters the browser.</p>
        </div>
        <button className="btn secondary" type="button" onClick={loadStatus} disabled={loading}><Icon name="refresh" size={16} /> {loading ? 'Checking...' : 'Refresh Status'}</button>
      </section>

      <p className="status-pill">{message}</p>

      <div className="metric-grid toast-integration-metrics">
        <div className="metric-card tone-green"><span className="metric-icon"><Icon name="cloud" /></span><span className="metric-label">Connection</span><strong>{isSupabaseReady ? 'Configured' : 'Setup Needed'}</strong><small>Supabase status</small></div>
        <div className="metric-card tone-blue"><span className="metric-icon"><Icon name="refresh" /></span><span className="metric-label">Last Import</span><strong>{latest?.status || 'No runs'}</strong><small>{formatDate(latest?.finished_at || latest?.started_at)}</small></div>
        <div className="metric-card tone-purple"><span className="metric-icon"><Icon name="spreadsheet" /></span><span className="metric-label">Files Today</span><strong>{todayFiles}</strong><small>Imported files</small></div>
        <div className="metric-card tone-orange"><span className="metric-icon"><Icon name="calendar" /></span><span className="metric-label">Schedule</span><strong>Daily</strong><small>After Toast closeout</small></div>
      </div>
<<<<<<< HEAD
      <div className={`integration-connection ${statusClass}`}>
        <span className="cloud-dot" />
<<<<<<< HEAD
        <strong>{!configured ? 'API Setup Needed' : status?.connected ? 'SFTP Connected' : 'Not Tested'}</strong>
=======
        <strong>{!configured ? 'API Setup Needed' : diagnostics?.connected || status?.connected ? 'SFTP Connected' : 'Not Tested'}</strong>
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
=======

      <div className="toast-integration-grid">
        <section className="section-card">
          <header className="section-card-header"><div><h2>Secure Worker Configuration</h2><small>Configure these only in the Render cron service</small></div></header>
          <div className="section-card-body toast-config-list">
            <div><b>SFTP host</b><span>s-9b0f88558b264dfda.server.transfer.us-east-1.amazonaws.com</span></div>
            <div><b>Username</b><span>IsabellaMexicanDataExports</span></div>
            <div><b>Export ID</b><span>144385</span></div>
            <div><b>Private key</b><span>Render Secret File: /etc/secrets/toast_restapay</span></div>
            <div><b>Recommended schedule</b><span>6:30 AM Central daily</span></div>
          </div>
        </section>

        <section className="table-card">
          <header><h2>Recent Import Runs</h2><span className="badge neutral">Last 20</span></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Started</th><th>Status</th><th>Business Date</th><th>Files</th><th>Rows</th><th>Message</th></tr></thead>
              <tbody>
                {runs.map(run => <tr key={run.id}><td>{formatDate(run.started_at)}</td><td><span className={`tag ${run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'orange'}`}>{run.status}</span></td><td>{run.business_date || '—'}</td><td>{run.files_imported || 0}</td><td>{run.rows_imported || 0}</td><td>{run.message || '—'}</td></tr>)}
                {!runs.length && <tr><td colSpan="6">No automated Toast imports recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
>>>>>>> e464eb1 (RC8 Toast SFTP automation, food and alcohol costing engine, Toast integration, Supabase import history)
      </div>

      <section className="table-card">
        <header><h2>Recent Toast Files</h2><span className="badge neutral">Raw export archive + parsed rows</span></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Business Date</th><th>Report</th><th>File</th><th>Rows</th><th>Status</th><th>Imported</th></tr></thead>
            <tbody>
              {files.map(file => <tr key={file.id}><td>{file.business_date || '—'}</td><td>{file.report_type || 'Other'}</td><td>{file.file_name}</td><td>{file.row_count || 0}</td><td>{file.status || 'Imported'}</td><td>{formatDate(file.imported_at)}</td></tr>)}
              {!files.length && <tr><td colSpan="6">No Toast files imported yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
<<<<<<< HEAD

    <div className="status-pill">{message}</div>

    <section className="settings-grid toast-settings-grid">
      <div className="form-card tight-card">
        <h2>Connection</h2>
        <div className="settings-status-grid toast-status-grid">
          <div><span>Backend API</span><b>{configured ? API_URL : 'Not configured'}</b></div>
<<<<<<< HEAD
          <div><span>SFTP</span><b className={statusClass}>{status?.connected ? 'Connected' : 'Waiting'}</b></div>
          <div><span>Export ID</span><b>{status?.exportId || 'Configured on server'}</b></div>
          <div><span>Last sync</span><b>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Not yet'}</b></div>
        </div>
=======
          <div><span>SFTP</span><b className={statusClass}>{diagnostics?.connected || status?.connected ? 'Connected' : 'Waiting'}</b></div>
          <div><span>Export ID</span><b>{status?.exportId || 'Configured on server'}</b></div>
          <div><span>Last sync</span><b>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Not yet'}</b></div>
        </div>

        {diagnostics ? <div className="toast-diagnostic-panel">
          <div><span>Remote directory</span><b>{diagnostics.cwd || '/'}</b></div>
          <div><span>Export ID</span><b>{diagnostics.exportId || status?.exportId || '144385'}</b></div>
          <div><span>Files available</span><b>{diagnostics.filesAvailable ?? 0}</b></div>
          <div><span>Export status</span><b className={diagnostics.waitingForFirstExport ? 'status-warn' : 'status-ok'}>{diagnostics.waitingForFirstExport ? 'Waiting for first Toast export' : 'Files ready'}</b></div>
        </div> : null}

>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
        <div className="settings-actions toast-action-row">
          <button className="btn secondary" type="button" disabled={loading || !configured} onClick={() => runAction('/api/toast/test', 'Testing Toast SFTP connection...')}><Icon name="refresh" /> Test Connection</button>
          <button className="btn primary" type="button" disabled={loading || !configured} onClick={() => runAction('/api/toast/sync', 'Checking Toast for new export files...')}><Icon name="download" /> Sync Now</button>
          <button className="btn ghost" type="button" disabled={loading || !configured} onClick={loadStatus}><Icon name="refresh" /> Refresh Status</button>
        </div>
      </div>

      <div className="form-card tight-card">
        <h2>Automatic Schedule</h2>
        <div className="settings-status-grid toast-status-grid">
          <div><span>Recommended run</span><b>Daily after 5:15 AM Central</b></div>
          <div><span>Configured by</span><b>Render Cron Job</b></div>
          <div><span>Duplicate protection</span><b className="status-ok">Enabled</b></div>
          <div><span>Private key</span><b className="status-ok">Backend only</b></div>
        </div>
        <p className="helper-text">The private SSH key must be stored only in the backend service environment. It is never included in the browser or frontend ZIP.</p>
      </div>
    </section>

    <section className="table-card toast-history-card">
      <div className="section-head"><div><h2>Sync History</h2><p>Recent connection and import attempts.</p></div></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Started</th><th>Status</th><th>Files Found</th><th>Imported</th><th>Message</th></tr></thead>
          <tbody>
            {history.length ? history.map(run => <tr key={run.id || `${run.started_at}-${run.status}`}>
              <td>{run.started_at ? new Date(run.started_at).toLocaleString() : '—'}</td>
              <td><span className={`status-badge ${run.status === 'success' ? 'paid' : run.status === 'failed' ? 'overdue' : 'pending'}`}>{run.status || 'unknown'}</span></td>
              <td>{run.files_found ?? 0}</td>
              <td>{run.files_imported ?? 0}</td>
              <td>{run.message || '—'}</td>
            </tr>) : <tr><td colSpan="5" className="empty-cell">No Toast sync attempts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>
=======
  )
>>>>>>> e464eb1 (RC8 Toast SFTP automation, food and alcohol costing engine, Toast integration, Supabase import history)
}
