import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'

const API_URL = (import.meta.env.VITE_TOAST_SYNC_API_URL || '').replace(/\/$/, '')

async function request(path, options = {}) {
  if (!API_URL) throw new Error('Toast Sync API URL is not configured. Add VITE_TOAST_SYNC_API_URL when building the frontend.')
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || payload.message || `Request failed (${response.status})`)
  return payload
}

export default function ToastIntegration() {
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

  async function loadStatus() {
    if (!configured) return
    try {
      const [statusResult, historyResult] = await Promise.all([
        request('/api/toast/status'),
        request('/api/toast/history?limit=20')
      ])
      setStatus(statusResult)
      setHistory(historyResult.runs || [])
    } catch (error) {
      setMessage(error.message)
    }
  }

  useEffect(() => { loadStatus() }, [])

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

  return <>
    <div className="page-head toast-integration-head">
      <div>
        <h1>Toast Integration</h1>
        <p>Securely pull Toast Data Export files through the RC8 backend sync service.</p>
      </div>
      <div className={`integration-connection ${statusClass}`}>
        <span className="cloud-dot" />
<<<<<<< HEAD
        <strong>{!configured ? 'API Setup Needed' : status?.connected ? 'SFTP Connected' : 'Not Tested'}</strong>
=======
        <strong>{!configured ? 'API Setup Needed' : diagnostics?.connected || status?.connected ? 'SFTP Connected' : 'Not Tested'}</strong>
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
      </div>
    </div>

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
}
