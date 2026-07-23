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
let lastKnownRun = null

app.disable('x-powered-by')
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.allowedOrigin === '*' || config.allowedOrigin === true) {
      callback(null, true)
      return
    }

    const allowed = String(config.allowedOrigin)
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)

    callback(null, allowed.includes(origin))
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-restapay-sync-key']
}))
app.use(express.json({ limit: '1mb' }))

function requireApiKey(req, res, next) {
  if (!config.syncApiKey) return next()

  const supplied = req.get('x-restapay-sync-key')
    || req.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (supplied !== config.syncApiKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized Toast sync request.' })
  }

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
  lastKnownRun = data || lastKnownRun
  return data || null
}

function zonedParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: config.toast.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
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

    if (offset > 0 || currentMinutes < targetMinutes) {
      return {
        date: dateKey,
        hour: config.autoSyncHour,
        minute: config.autoSyncMinute,
        timezone: config.toast.timezone
      }
    }
  }

  return null
}

async function normalizedCounts() {
  const tables = [
    'toast_sales_summary',
    'toast_sales_categories',
    'toast_product_mix',
    'toast_labor',
    'toast_payments',
    'toast_checks',
    'toast_cash_management',
    'toast_menu_items',
    'toast_daily_summary'
  ]

  const result = {}
  await Promise.all(tables.map(async table => {
    try {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })

      result[table] = error ? null : Number(count || 0)
    } catch {
      result[table] = null
    }
  }))

  return result
}

async function cancelStaleRuns() {
  const cutoff = new Date(
    Date.now() - Math.max(config.syncTimeoutMs * 2, 30 * 60 * 1000)
  ).toISOString()

  const { error } = await supabaseAdmin
    .from('toast_import_runs')
    .update({
      status: 'cancelled',
      finished_at: new Date().toISOString(),
      message: 'Automatically cancelled stale sync after service restart.'
    })
    .eq('status', 'running')
    .lt('heartbeat_at', cutoff)

  if (error && !/heartbeat_at|does not exist|schema cache/i.test(error.message || '')) {
    console.warn('Unable to cancel stale Toast runs:', error.message)
  }
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
    let timedOut = false

    const timeout = setTimeout(() => {
      timedOut = true
      if (!child.killed) child.kill('SIGTERM')
    }, config.syncTimeoutMs)

    child.stdout.on('data', chunk => {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on('data', chunk => {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.once('error', error => {
      clearTimeout(timeout)
      reject(error)
    })

    child.once('close', async (code, signal) => {
      clearTimeout(timeout)
      activeChild = null

      try {
        let run = null
        try {
          run = await latestRun()
        } catch (error) {
          console.warn('Could not read latest Toast run after child exit:', error.message)
          run = lastKnownRun
        }

        if (run?.status === 'running' && (signal || code !== 0 || timedOut)) {
          const message = timedOut
            ? `Toast sync exceeded ${config.syncTimeoutMs} ms and was stopped. The next run will resume.`
            : signal
              ? `Toast sync interrupted by ${signal}. The next run will resume and skip files already imported.`
              : `Toast sync stopped before completion with exit code ${code}.`

          try {
            const { data, error } = await supabaseAdmin
              .from('toast_import_runs')
              .update({
                status: 'cancelled',
                finished_at: new Date().toISOString(),
                error_count: Number(run.error_count || 0) + 1,
                message
              })
              .eq('id', run.id)
              .select('*')
              .maybeSingle()

            if (error) throw error
            run = data || run
            lastKnownRun = run
          } catch (error) {
            console.warn('Could not mark Toast run as cancelled:', error.message)
          }
        }

        const payload = {
          ok: code === 0 && run?.status === 'success',
          exitCode: code,
          signal: signal || null,
          timedOut,
          run,
          output: stdout.trim().split('\n').filter(Boolean).slice(-20),
          errorOutput: stderr.trim().split('\n').filter(Boolean).slice(-20)
        }

        if (payload.ok) resolve(payload)
        else reject(Object.assign(
          new Error(run?.message || stderr || `Toast sync exited with code ${code}`),
          { payload }
        ))
      } catch (error) {
        reject(error)
      }
    })
  }).finally(() => {
    activeSync = null
    activeChild = null
  })

  return activeSync
}

async function maybeRunAutomaticSync() {
  if (!config.autoSyncEnabled || activeSync) return

  const parts = zonedParts()
  const dateKey = `${parts.year}-${parts.month}-${parts.day}`
  const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute)
  const targetMinutes = config.autoSyncHour * 60 + config.autoSyncMinute

  if (
    currentMinutes < targetMinutes
    || currentMinutes > targetMinutes + 4
    || lastAutomaticSyncDate === dateKey
  ) return

  lastAutomaticSyncDate = dateKey
  console.log(
    `Starting automatic Toast sync for ${dateKey} at ${parts.hour}:${parts.minute} ${config.toast.timezone}`
  )

  executeSync().catch(error => {
    console.error('Automatic Toast sync failed:', error.message)
  })
}

// IMPORTANT: Render health checks must never depend on Supabase, Toast SFTP,
// migrations, or a long-running sync. This endpoint always responds quickly.
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'restapay-toast-sync',
    syncing: Boolean(activeSync),
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  })
})

app.get('/api/toast/status', async (_req, res) => {
  let run = lastKnownRun
  let databaseError = null

  try {
    run = await latestRun()
  } catch (error) {
    databaseError = error.message
  }

  res.status(200).json({
    ok: !databaseError,
    configured: true,
    syncing: Boolean(activeSync),
    connected: run?.status === 'success',
    exportId: config.toast.exportId,
    lastSyncAt: run?.finished_at || run?.started_at || null,
    lastRun: run || null,
    databaseError,
    schedule: {
      enabled: config.autoSyncEnabled,
      hour: config.autoSyncHour,
      minute: config.autoSyncMinute,
      timezone: config.toast.timezone,
      next: nextScheduledSync()
    },
    normalizedCounts: databaseError ? {} : await normalizedCounts()
  })
})

app.get('/api/toast/history', async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100)
    const { data, error } = await supabaseAdmin
      .from('toast_import_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    res.json({ ok: true, runs: data || [] })
  } catch (error) {
    next(error)
  }
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
  } catch (error) {
    next(error)
  }
})

app.get('/api/toast/diagnostics', requireApiKey, async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await testToastConnection()) })
  } catch (error) {
    next(error)
  }
})

app.post('/api/toast/sync', requireApiKey, async (_req, res, next) => {
  try {
    if (activeSync) {
      return res.status(202).json({
        ok: true,
        syncing: true,
        message: 'A Toast sync is already running.'
      })
    }

    const result = await executeSync()
    res.json(result)
  } catch (error) {
    next(error)
  }
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

process.once('SIGINT', () => {
  shutdown('SIGINT').catch(error => {
    console.error(error)
    process.exit(1)
  })
})

process.once('SIGTERM', () => {
  shutdown('SIGTERM').catch(error => {
    console.error(error)
    process.exit(1)
  })
})

const host = '0.0.0.0'
const port = Number(process.env.PORT || config.port || 10000)

app.listen(port, host, () => {
  console.log(`RestaPay Toast Sync listening on http://${host}:${port}`)
})

// Startup maintenance is intentionally non-blocking. A missing migration or
// temporary Supabase issue will not prevent Render from marking the service live.
setTimeout(() => {
  cancelStaleRuns().catch(error => {
    console.warn('Toast stale-run cleanup skipped:', error.message)
  })
}, 1000).unref()

setInterval(() => {
  maybeRunAutomaticSync().catch(error => {
    console.error('Automatic Toast sync scheduler error:', error.message)
  })
}, 60000).unref()
