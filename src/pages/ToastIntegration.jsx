import React, { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { isSupabaseReady, supabase } from '../lib/supabase'

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}
function money(value) {
  return Number(value || 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}

export default function ToastIntegration() {
  const [runs, setRuns] = useState([])
  const [files, setFiles] = useState([])
  const [daily, setDaily] = useState([])
  const [feeRows, setFeeRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [schemaReady, setSchemaReady] = useState(false)
  const [message, setMessage] = useState('Checking Toast automation status...')
  const [lastChecked, setLastChecked] = useState(null)
  const [workerAction, setWorkerAction] = useState('')
  const [workerApiStatus, setWorkerApiStatus] = useState(null)
  const apiUrl = String(import.meta.env.VITE_TOAST_SYNC_API_URL || '').replace(/\/$/, '')

  async function loadStatus() {
    setLoading(true)

    const workerStatusPromise = apiUrl
      ? fetch(`${apiUrl}/api/toast/status`, { cache: 'no-store' }).then(async response => {
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload.error || `Worker returned ${response.status}`)
          return payload
        }).catch(error => ({ ok: false, connected: false, error: error.message }))
      : Promise.resolve({ ok: false, connected: false, error: 'VITE_TOAST_SYNC_API_URL is not configured.' })

    const databasePromises = isSupabaseReady && supabase
      ? [
          supabase.from('toast_import_runs').select('*').order('started_at', { ascending: false }).limit(20),
          supabase.from('toast_import_files').select('*').order('imported_at', { ascending: false }).limit(50),
          supabase.from('toast_daily_summary').select('*').order('business_date', { ascending: false }).limit(31),
          supabase.from('toast_merchant_fees').select('*').order('business_date', { ascending: false }).limit(50)
        ]
      : [Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null }), Promise.resolve({ data: [], error: null })]

    const [runResult, fileResult, dailyResult, feeResult, workerStatus] = await Promise.all([
      ...databasePromises,
      workerStatusPromise
    ])

    setWorkerApiStatus(workerStatus)

    const workerRun = workerStatus?.lastRun ? [workerStatus.lastRun] : []
    const nextRuns = runResult?.data?.length ? runResult.data : workerRun
    setRuns(nextRuns)
    setFiles(fileResult?.data || [])
    setDaily(dailyResult?.data || [])
    setFeeRows(feeResult?.error ? [] : (feeResult?.data || []))

    const coreDatabaseError = runResult?.error || fileResult?.error || dailyResult?.error
    const workerHealthy = Boolean(workerStatus?.ok && workerStatus?.configured)
    const databaseHealthy = Boolean(isSupabaseReady && !coreDatabaseError)
    const ready = workerHealthy || databaseHealthy

    setSchemaReady(ready)
    if (workerHealthy) {
      const syncState = workerStatus.syncing ? 'Sync is currently running.' : 'Automation is ready.'
      setMessage(`Toast cloud connection is active. ${syncState}`)
    } else if (databaseHealthy) {
      setMessage('Toast database tables are ready, but the Render sync API could not be reached.')
    } else if (!isSupabaseReady) {
      setMessage(workerStatus?.error || 'Frontend Supabase settings and Toast sync API URL are missing.')
    } else {
      setMessage(`Toast status check needs attention: ${coreDatabaseError?.message || workerStatus?.error || 'Unknown connection error.'}`)
    }

    setLastChecked(new Date().toISOString())
    setLoading(false)
  }


  async function callWorker(path, label) {
    if (!apiUrl) { setWorkerAction('Toast worker API URL is missing. Add VITE_TOAST_SYNC_API_URL to the frontend environment.'); return }
    setWorkerAction(`${label}...`)
    try {
      const response = await fetch(`${apiUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || `Worker returned ${response.status}`)
      setWorkerAction(payload.message || `${label} completed successfully.`)
      await loadStatus()
    } catch (error) { setWorkerAction(`${label} failed: ${error.message}`) }
  }

  useEffect(() => {
    loadStatus()
    const timer = window.setInterval(() => loadStatus(), workerApiStatus?.syncing || runs[0]?.status === 'running' ? 3000 : 15000)
    return () => window.clearInterval(timer)
  }, [apiUrl, workerApiStatus?.syncing, runs[0]?.status])

  const latest = runs[0] || workerApiStatus?.lastRun
  const latestDaily = daily[0]
  const todayFiles = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return files.filter(file => String(file.business_date || file.imported_at || '').slice(0, 10) === today).length
  }, [files])
  const merchantFees = useMemo(() => feeRows.reduce((sum, row) => sum + Number(row.fee_amount || 0), 0), [feeRows])
  const normalizedTotal = useMemo(() => Object.values(workerApiStatus?.normalizedCounts || {}).reduce((sum, count) => sum + Number(count || 0), 0), [workerApiStatus])
  const scheduleLabel = workerApiStatus?.schedule?.enabled
    ? `${String(workerApiStatus.schedule.hour).padStart(2, '0')}:${String(workerApiStatus.schedule.minute).padStart(2, '0')} ${workerApiStatus.schedule.timezone || ''}`
    : 'Disabled'
  const workerHealth = useMemo(() => {
    if (workerApiStatus?.ok && workerApiStatus?.connected) {
      if (workerApiStatus?.syncing) return { tone: 'orange', label: 'Syncing now', detail: 'Toast SFTP is connected and a sync is in progress.' }
    }
    if (!schemaReady) return { tone: 'red', label: 'Connection needs attention', detail: workerApiStatus?.error || 'Toast data services could not be reached.' }
    if (!latest) return { tone: 'orange', label: 'Configured — no run yet', detail: 'Services are configured, but no completed worker run has been recorded.' }
    const stamp = latest.finished_at || latest.started_at
    const ageHours = stamp ? (Date.now() - new Date(stamp).getTime()) / 3600000 : Infinity
    if (latest.status === 'failed') return { tone: 'red', label: 'Last run failed', detail: latest.message || 'Open Recent Import Runs for details.' }
    if (latest.status === 'success' && ageHours <= 48) return { tone: 'green', label: 'Connected', detail: `Successful worker import ${formatDate(stamp)}.` }
    if (latest.status === 'success') return { tone: 'orange', label: 'Connected — import is stale', detail: `Last success was ${Math.floor(ageHours)} hours ago.` }
    return { tone: 'orange', label: latest.status || 'Pending', detail: latest.message || 'Worker has not completed a successful import.' }
  }, [schemaReady, latest, workerApiStatus])

  const connectionChecks = useMemo(() => [
    { label: 'Browser → Supabase', ok: Boolean(isSupabaseReady && !(!runs.length && !files.length && !daily.length && workerApiStatus?.ok)), detail: isSupabaseReady ? 'Frontend Supabase configuration is present.' : 'Frontend can still show worker status, but direct table drilldowns require Supabase environment variables.' },
    { label: 'Browser → Render sync API', ok: Boolean(workerApiStatus?.ok), detail: workerApiStatus?.ok ? (workerApiStatus.syncing ? 'Worker API is reachable and a sync is running.' : 'Worker API is reachable and ready.') : (workerApiStatus?.error || (apiUrl ? 'Worker API could not be reached.' : 'VITE_TOAST_SYNC_API_URL is missing.')) },
    { label: 'Render worker → Supabase', ok: Boolean(workerApiStatus?.ok && !workerApiStatus?.databaseError), detail: workerApiStatus?.databaseError || (latest ? `Latest run: ${latest.status || 'unknown'}.` : 'Worker is reachable; no run has been recorded yet.') },
    { label: 'Toast SFTP → Render worker', ok: Boolean(workerApiStatus?.connected), detail: workerApiStatus?.connected ? 'Private SFTP connection is active.' : (workerApiStatus?.error || 'Use Test Connection or Run Sync Now to verify the private SFTP connection.') },
    { label: 'Normalized Toast data', ok: normalizedTotal > 0 || files.length > 0 || daily.length > 0, detail: normalizedTotal > 0 ? `${normalizedTotal.toLocaleString()} normalized Toast rows are available.` : (files.length || daily.length ? `${files.length} recent files and ${daily.length} daily summaries are readable.` : 'No imported Toast rows are visible yet.') }
  ], [schemaReady, latest, files.length, daily.length, workerApiStatus, apiUrl, normalizedTotal, runs.length])

  return (
    <div className="toast-integration-page">
      <section className="form-card toast-integration-hero">
        <div>
          <span className="eyebrow">Automated Data Connection</span>
          <h2>Toast SFTP Integration</h2>
          <p>Toast exports are downloaded by a secure Render cron job, parsed into dedicated Supabase tables, and made available to RestaPay on every computer. The private SSH key never enters the browser.</p>
        </div>
        <div className="actions"><button className="btn secondary" type="button" onClick={loadStatus} disabled={loading}><Icon name="refresh" size={16} /> {loading ? 'Checking...' : 'Refresh Status'}</button><button className="btn secondary" type="button" onClick={() => callWorker('/api/toast/test', 'Testing SFTP connection')} disabled={!apiUrl}><Icon name="cloud" size={16} /> Test Connection</button><button className="btn primary" type="button" onClick={() => callWorker('/api/toast/sync', 'Running Toast sync')} disabled={!apiUrl}><Icon name="download" size={16} /> Run Sync Now</button></div>
      </section>

      <p className={`status-pill ${schemaReady ? 'success' : ''}`}>{message}</p>{workerAction && <p className={`status-pill ${workerAction.includes('failed') || workerAction.includes('missing') ? '' : 'success'}`}>{workerAction}</p>}

      {latest?.status === 'running' && <section className="table-card toast-live-progress">
        <header><div><h2>Toast Sync in Progress</h2><p>{latest.message || 'Processing Toast exports...'}</p></div><span className="tag orange">{Number(latest.progress_percent || 0)}%</span></header>
        <div className="toast-progress-track"><span style={{ width: `${Math.max(2, Number(latest.progress_percent || 0))}%` }} /></div>
        <div className="toast-progress-meta">
          <span><b>{latest.processed_files || 0}</b> of <b>{latest.total_files || 0}</b> files</span>
          <span>{latest.current_business_date || latest.business_date || 'Preparing date'}</span>
          <span>{latest.current_report_type || 'Detecting report'}</span>
          <span className="toast-current-file">{latest.current_file || 'Connecting...'}</span>
        </div>
      </section>}

      <section className="table-card toast-connection-audit">
        <header>
          <div><h2>Toast Connection Check</h2><p>Checks the real data path: Toast SFTP → Render worker → Supabase → RestaPay.</p></div>
          <div className="toast-health-actions"><span className={`tag ${workerHealth.tone}`}>{workerHealth.label}</span><small>Checked {formatDate(lastChecked)}</small></div>
        </header>
        <div className="toast-connection-checks">
          {connectionChecks.map(check => <article key={check.label} className={check.ok ? 'ok' : 'needs-attention'}><span className="toast-check-icon"><Icon name={check.ok ? 'check' : 'alertTriangle'} size={17} /></span><div><b>{check.label}</b><small>{check.detail}</small></div></article>)}
        </div>
        <div className="toast-connection-note"><Icon name="shield" size={16} /><span>RestaPay cannot test the private Toast SFTP key from the browser. A recent successful row in <b>toast_import_runs</b> plus imported files confirms the connection works.</span></div>
      </section>

      <div className="metric-grid toast-integration-metrics">
        <div className="metric-card tone-green"><span className="metric-icon"><Icon name="cloud" /></span><span className="metric-label">Database Schema</span><strong>{schemaReady ? 'Ready' : 'Attention'}</strong><small>{schemaReady ? 'Toast data services available' : 'Check API and Supabase settings'}</small></div>
        <div className="metric-card tone-blue"><span className="metric-icon"><Icon name="refresh" /></span><span className="metric-label">Last Import</span><strong>{latest?.status || 'No runs'}</strong><small>{formatDate(latest?.finished_at || latest?.started_at)}</small></div>
        <div className="metric-card tone-purple"><span className="metric-icon"><Icon name="spreadsheet" /></span><span className="metric-label">Normalized Rows</span><strong>{normalizedTotal.toLocaleString()}</strong><small>{todayFiles} files visible today</small></div>
        <div className="metric-card tone-orange"><span className="metric-icon"><Icon name="calendar" /></span><span className="metric-label">Automatic Schedule</span><strong>{workerApiStatus?.schedule?.enabled ? 'Daily' : 'Off'}</strong><small>{scheduleLabel}</small></div>
      </div>

      {latestDaily && <section className="table-card toast-latest-summary">
        <header><h2>Latest Imported Business Day</h2><span className="badge neutral">{latestDaily.business_date}</span></header>
        <div className="toast-summary-grid">
          <div><span>Food Sales</span><strong>{money(latestDaily.food_sales)}</strong></div>
          <div><span>Alcohol Sales</span><strong>{money(latestDaily.alcohol_sales)}</strong></div>
          <div><span>Other Sales</span><strong>{money(latestDaily.other_sales)}</strong></div>
          <div><span>Toast Net Sales</span><strong>{money(latestDaily.toast_net_sales)}</strong></div>
          <div><span>Merchant Fees</span><strong>{money(latestDaily.merchant_fees)}</strong></div>
          <div><span>Labor Excluding Tips</span><strong>{money(latestDaily.labor_pay)}</strong></div>
          <div><span>Tips (Pass-through)</span><strong>{money(latestDaily.tips)}</strong></div>
        </div>
      </section>}

      <div className="toast-integration-grid">
        <section className="section-card">
          <header className="section-card-header"><div><h2>Secure Worker Configuration</h2><small>Configure these only in the Render cron service</small></div></header>
          <div className="section-card-body toast-config-list">
            <div><b>SFTP host</b><span>s-9b0f88558b264dfda.server.transfer.us-east-1.amazonaws.com</span></div>
            <div><b>Username</b><span>IsabellaMexicanDataExports</span></div>
            <div><b>Export ID</b><span>144385</span></div>
            <div><b>Private key</b><span>Render Secret File: /etc/secrets/toast_restapay</span></div>
            <div><b>Automatic schedule</b><span>{scheduleLabel}</span></div>
            <div><b>Manual test command</b><span>npm run test (inside toast-worker)</span></div>
          </div>
        </section>

        <section className="table-card">
          <header><h2>Recent Import Runs</h2><span className="badge neutral">Last 20</span></header>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Started</th><th>Status</th><th>Business Date</th><th>Imported</th><th>Skipped</th><th>Rows</th><th>Message</th></tr></thead>
              <tbody>
                {runs.map(run => <tr key={run.id}><td>{formatDate(run.started_at)}</td><td><span className={`tag ${run.status === 'success' ? 'green' : run.status === 'failed' ? 'red' : 'orange'}`}>{run.status}</span></td><td>{run.business_date || '—'}</td><td>{run.files_imported || 0}</td><td>{run.files_skipped || 0}</td><td>{run.rows_imported || 0}</td><td>{run.message || '—'}</td></tr>)}
                {!runs.length && <tr><td colSpan="7">No automated Toast imports recorded yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="table-card">
        <header><h2>Recent Toast Files</h2><span className="badge neutral">Raw archive + normalized tables</span></header>
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

      <section className="table-card">
        <header><h2>Merchant Processing Fees</h2><span className="badge neutral">Operating expense total: {money(merchantFees)}</span></header>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Processor</th><th>Payment Type</th><th>Gross Card Sales</th><th>Fee</th><th>Net Deposit</th><th>Source</th></tr></thead>
            <tbody>
              {feeRows.map(row => <tr key={row.id}><td>{row.business_date}</td><td>{row.processor}</td><td>{row.payment_type}</td><td>{money(row.gross_card_sales)}</td><td>{money(row.fee_amount)}</td><td>{money(row.net_deposit)}</td><td>{row.source_file}</td></tr>)}
              {!feeRows.length && <tr><td colSpan="7">No merchant-fee rows imported yet. They will appear when Toast exports include fee fields.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
