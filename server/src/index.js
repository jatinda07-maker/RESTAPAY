import express from 'express'
import cors from 'cors'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { config } from './config.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { testToastConnection } from './toastSftp.js'

const app = express()
const currentDir = path.dirname(fileURLToPath(import.meta.url))
const syncScript = path.join(currentDir, 'syncToastJob.js')
let activeSync = null

app.use(cors({ origin: config.allowedOrigin === '*' ? true : config.allowedOrigin }))
app.use(express.json({ limit: '1mb' }))

function requireApiKey(req, res, next) {
  if (!config.syncApiKey) return next()
  const supplied = req.get('x-restapay-sync-key') || req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (supplied !== config.syncApiKey) return res.status(401).json({ ok: false, error: 'Unauthorized Toast sync request.' })
  next()
}

async function latestRun() {
  const { data, error } = await supabaseAdmin
    .from('toast_import_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data || null
}

function executeSync() {
  if (activeSync) return activeSync
  activeSync = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [syncScript], {
      cwd: currentDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGTERM'), config.syncTimeoutMs)
    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
      process.stdout.write(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
      process.stderr.write(chunk)
    })
    child.on('error', reject)
    child.on('close', async code => {
      clearTimeout(timeout)
      try {
        const run = await latestRun()
        const payload = {
          ok: code === 0 && run?.status === 'success',
          exitCode: code,
          run,
          output: stdout.trim().split('\n').slice(-20),
          errorOutput: stderr.trim().split('\n').filter(Boolean).slice(-20)
        }
        if (payload.ok) resolve(payload)
        else reject(Object.assign(new Error(run?.message || stderr || `Toast sync exited with code ${code}`), { payload }))
      } catch (error) {
        reject(error)
      }
    })
  }).finally(() => { activeSync = null })
  return activeSync
}

app.get('/health', async (_req, res) => {
  try {
    const run = await latestRun()
    res.json({ ok: true, service: 'restapay-toast-sync', syncing: Boolean(activeSync), lastRun: run })
  } catch (error) {
    res.status(503).json({ ok: false, service: 'restapay-toast-sync', error: error.message })
  }
})

app.get('/api/toast/status', async (_req, res, next) => {
  try {
    const run = await latestRun()
    res.json({
      ok: true,
      configured: true,
      syncing: Boolean(activeSync),
      connected: run?.status === 'success',
      exportId: config.toast.exportId,
      lastSyncAt: run?.finished_at || run?.started_at || null,
      lastRun: run
    })
  } catch (error) { next(error) }
})

app.get('/api/toast/history', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100)
    const { data, error } = await supabaseAdmin.from('toast_import_runs').select('*').order('started_at', { ascending: false }).limit(limit)
    if (error) throw error
    res.json({ ok: true, runs: data || [] })
  } catch (error) { next(error) }
})

app.post('/api/toast/test', requireApiKey, async (_req, res, next) => {
  try {
    const result = await testToastConnection()
    res.json({
      ok: true,
      ...result,
      message: result.waitingForFirstExport
        ? `Connected to Toast SFTP. Export ${result.exportId} is authenticated; waiting for a dated export folder.`
        : `Connected to Toast SFTP. Found ${result.filesAvailable} file(s) under ${result.firstAvailablePath}.`
    })
  } catch (error) { next(error) }
})

app.get('/api/toast/diagnostics', requireApiKey, async (_req, res, next) => {
  try { res.json({ ok: true, ...(await testToastConnection()) }) } catch (error) { next(error) }
})

app.post('/api/toast/sync', requireApiKey, async (_req, res, next) => {
  try {
    if (activeSync) return res.status(202).json({ ok: true, syncing: true, message: 'A Toast sync is already running.' })
    const result = await executeSync()
    res.json(result)
  } catch (error) { next(error) }
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(error.status || 500).json({
    ok: false,
    error: error.message || 'Unexpected server error',
    details: error.payload || undefined
  })
})

app.listen(config.port, () => console.log(`RestaPay Toast Sync listening on port ${config.port}`))
