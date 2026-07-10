import SftpClient from 'ssh2-sftp-client'
import { config } from './config.js'

export function connectionOptions() {
  return {
    host: config.toast.host,
    port: config.toast.port,
    username: config.toast.username,
    privateKey: config.toast.privateKey(),
    readyTimeout: 30000
  }
}

export async function withSftp(work) {
  const client = new SftpClient('restapay-toast-sync')
  try {
    await client.connect(connectionOptions())
    return await work(client)
  } finally {
    await client.end().catch(() => {})
  }
}

export async function testToastConnection() {
  return withSftp(async client => {
    const cwd = await client.cwd()
    const root = await client.list('/')
    return { connected: true, cwd, rootEntries: root.map(item => item.name) }
  })
}
