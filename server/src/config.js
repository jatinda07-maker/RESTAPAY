import fs from 'node:fs'
import dotenv from 'dotenv'

dotenv.config()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function privateKey() {
  if (process.env.TOAST_SFTP_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.TOAST_SFTP_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
  }
  if (process.env.TOAST_SFTP_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.TOAST_SFTP_PRIVATE_KEY_PATH, 'utf8')
  }
  throw new Error('Missing TOAST_SFTP_PRIVATE_KEY_BASE64 or TOAST_SFTP_PRIVATE_KEY_PATH')
}

export const config = {
  port: Number(process.env.PORT || 8787),
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  toast: {
    host: required('TOAST_SFTP_HOST'),
    port: Number(process.env.TOAST_SFTP_PORT || 22),
    username: required('TOAST_SFTP_USERNAME'),
    exportId: required('TOAST_EXPORT_ID'),
    timezone: process.env.TOAST_TIMEZONE || 'America/Chicago',
    lookbackDays: Number(process.env.TOAST_LOOKBACK_DAYS || 7),
    privateKey
  }
}
