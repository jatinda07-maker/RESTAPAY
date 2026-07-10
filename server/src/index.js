import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { testToastConnection } from './toastSftp.js'
import { syncToastExports } from './syncService.js'

const app = express()
app.use(cors({ origin: config.allowedOrigin === '*' ? true : config.allowedOrigin }))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => res.json({ ok: true, service: 'restapay-toast-sync' }))

app.get('/api/toast/status', async (_req, res) => {
  const { data } = await supabaseAdmin.from('toast_sync_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle()
  res.json({ connected: false, exportId: config.toast.exportId, lastSyncAt: data?.completed_at || null, lastRun: data || null })
})

app.get('/api/toast/history', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100)
    const { data, error } = await supabaseAdmin.from('toast_sync_runs').select('*').order('started_at', { ascending: false }).limit(limit)
    if (error) throw error
    res.json({ runs: data || [] })
  } catch (error) { next(error) }
})

app.post('/api/toast/test', async (_req, res, next) => {
  try {
    const result = await testToastConnection()
    res.json({ ...result, message: `Connected to Toast SFTP. Remote directory: ${result.cwd}` })
  } catch (error) { next(error) }
})

app.post('/api/toast/sync', async (_req, res, next) => {
  try { res.json(await syncToastExports()) } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: error.message || 'Unexpected server error' })
})

app.listen(config.port, () => console.log(`RestaPay Toast Sync listening on port ${config.port}`))
