import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function privateKey() {
  const base64 = process.env.TOAST_SFTP_PRIVATE_KEY_BASE64 || process.env.TOAST_PRIVATE_KEY_BASE64
  if (base64) return Buffer.from(base64, 'base64').toString('utf8')

  const inline = process.env.TOAST_SFTP_PRIVATE_KEY || process.env.TOAST_PRIVATE_KEY
  if (inline) return inline.replace(/\\n/g, '\n')

  const keyPath = process.env.TOAST_SFTP_PRIVATE_KEY_PATH || process.env.TOAST_PRIVATE_KEY_PATH
  if (keyPath) return fs.readFileSync(keyPath, 'utf8')

  throw new Error('Missing Toast private key. Configure TOAST_PRIVATE_KEY_PATH, TOAST_PRIVATE_KEY_BASE64, or TOAST_PRIVATE_KEY.')
}

export const config = {
  port: Number(process.env.PORT || 8787),
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  syncApiKey: process.env.TOAST_SYNC_API_KEY || '',
  syncTimeoutMs: Number(process.env.TOAST_SYNC_TIMEOUT_MS || 10 * 60 * 1000),
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  toast: {
    host: required('TOAST_SFTP_HOST'),
    port: Number(process.env.TOAST_SFTP_PORT || 22),
    username: required('TOAST_SFTP_USERNAME'),
    exportId: process.env.TOAST_EXPORT_ID || '144385',
    timezone: process.env.TOAST_TIMEZONE || 'America/Chicago',
    lookbackDays: Number(process.env.TOAST_LOOKBACK_DAYS || 8),
    privateKey
  }
}
