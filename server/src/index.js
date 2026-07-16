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
let activeChild = null
let lastAutomaticSyncDate = null

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



function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.toast.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date)
  return Object.fromEntries(parts.map(part => [part.type, part.value]))
}

function nextScheduledSync() {
  if (!config.autoSyncEnabled) return null
  const now = new Date()
  for (let offset = 0; offset < 3; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86400000)
    const parts = zonedParts(candidate)
    const dateKey = `${parts.year}-${parts.month}-${parts.day}`
    const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute)
    const targetMinutes = config.autoSyncHour * 60 + config.autoSyncMinute
    if (offset > 0 || currentMinutes < targetMinutes) return { date: dateKey, hour: config.autoSyncHour, minute: config.autoSyncMinute, timezone: config.toast.timezone }
  }
  return null
}

async function maybeRunAutomaticSync() {
  if (!config.autoSyncEnabled || activeSync) return
  const parts = zonedParts()
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute)
  const targetMinutes = config.autoSyncHour * 60 + config.autoSyncMinute
  if (currentMinutes < targetMinutes || currentMinutes > targetMinutes + 4 || lastAutomaticSyncDate === dateKey) return
  lastAutomaticSyncDate = dateKey
  console.log(`Starting automatic Toast sync for ${dateKey} at ${parts.hour}:${parts.minute} ${config.toast.timezone}`)
  executeSync().catch(error => console.error('Automatic Toast sync failed:', error.message))
}

async function normalizedCounts() {
  const tables = ['toast_sales_summary', 'toast_sales_categories', 'toast_product_mix', 'toast_labor', 'toast_payments', 'toast_checks', 'toast_cash_management', 'toast_menu_items', 'toast_daily_summary']
  const result = {}
  await Promise.all(tables.map(async table => {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    result[table] = error ? null : Number(count || 0)
  }))
  return result
}

async function cancelStaleRuns() {
  const cutoff = new Date(Date.now() - Math.max(config.syncTimeoutMs * 2, 30 * 60 * 1000)).toISOString()
  const { error } = await supabaseAdmin
    .from('toast_import_runs')
    .update({ status: 'cancelled', finished_at: new Date().toISOString(), message: 'Automatically cancelled stale sync after service restart.' })
    .eq('status', 'running')
    .lt('heartbeat_at', cutoff)
  if (error && !/heartbeat_at/i.test(error.message || '')) console.warn('Unable to cancel stale Toast runs:', error.message)
}

function executeSync() {
  if (activeSync) return activeSync
  activeSync = new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [syncScript], {
      cwd: currentDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    activeChild = child
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
    child.on('close', async (code, signal) => {
      clearTimeout(timeout)
      activeChild = null
      try {
        let run = await latestRun()
        if (run?.status === 'running' && (signal || code !== 0)) {
          const message = signal
            ? `Toast sync interrupted by ${signal}. The next run will resume and skip files already imported.`
            : `Toast sync stopped before completion with exit code ${code}.`
          const { data, error } = await supabaseAdmin
            .from('toast_import_runs')
            .update({ status: 'cancelled', finished_at: new Date().toISOString(), error_count: Number(run.error_count || 0) + 1, message })
            .eq('id', run.id)
            .select('*')
            .maybeSingle()
          if (error) throw error
          run = data || run
        }
        const payload = {
          ok: code === 0 && run?.status === 'success',
          exitCode: code,
          signal: signal || null,
          run,
          output: stdout.trim().split('\n').filter(Boolean).slice(-20),
          errorOutput: stderr.trim().split('\n').filter(Boolean).slice(-20)
        }
        if (payload.ok) resolve(payload)
        else reject(Object.assign(new Error(run?.message || stderr || `Toast sync exited with code ${code}`), { payload }))
      } catch (error) {
        reject(error)
      }
    })
  }).finally(() => { activeSync = null; activeChild = null })
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
      lastRun: run,
      schedule: {
        enabled: config.autoSyncEnabled,
        hour: config.autoSyncHour,
        minute: config.autoSyncMinute,
        timezone: config.toast.timezone,
        next: nextScheduledSync()
      },
      normalizedCounts: await normalizedCounts()
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


async function shutdown(signal) {
  console.log(`Received ${signal}; stopping Toast sync service...`)
  if (activeChild && !activeChild.killed) {
    activeChild.kill('SIGTERM')
    await new Promise(resolve => setTimeout(resolve, 750))
  }
  process.exit(0)
}

process.once('SIGINT', () => { shutdown('SIGINT').catch(error => { console.error(error); process.exit(1) }) })
process.once('SIGTERM', () => { shutdown('SIGTERM').catch(error => { console.error(error); process.exit(1) }) })

cancelStaleRuns().catch(error => console.warn(error))
setInterval(() => { maybeRunAutomaticSync().catch(error => console.error(error)) }, 60000).unref()
maybeRunAutomaticSync().catch(error => console.error(error))
app.listen(config.port, () => console.log(`RestaPay Toast Sync listening on port ${config.port}`))
