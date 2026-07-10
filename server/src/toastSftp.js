import SftpClient from 'ssh2-sftp-client'
import { config } from './config.js'
<<<<<<< HEAD
=======
import { candidateExportPaths } from './datePaths.js'
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)

export function connectionOptions() {
  return {
    host: config.toast.host,
    port: config.toast.port,
    username: config.toast.username,
    privateKey: config.toast.privateKey(),
<<<<<<< HEAD
    readyTimeout: 30000
=======
    readyTimeout: 30000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
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
<<<<<<< HEAD
    const root = await client.list('/')
    return { connected: true, cwd, rootEntries: root.map(item => item.name) }
=======
    const root = await client.list('/').catch(() => [])
    const checkedPaths = []
    let firstAvailablePath = null
    let filesAvailable = 0

    for (const remotePath of candidateExportPaths()) {
      try {
        const entries = await client.list(remotePath)
        const files = entries.filter(entry => entry.type !== 'd')
        checkedPaths.push({ path: remotePath, exists: true, files: files.length })
        filesAvailable += files.length
        if (!firstAvailablePath) firstAvailablePath = remotePath
      } catch {
        checkedPaths.push({ path: remotePath, exists: false, files: 0 })
      }
    }

    return {
      connected: true,
      cwd,
      exportId: config.toast.exportId,
      rootEntries: root.map(item => item.name),
      firstAvailablePath,
      filesAvailable,
      checkedPaths,
      waitingForFirstExport: !firstAvailablePath
    }
>>>>>>> 351b1ab (RC9 add food and alcohol profit centers with Toast SFTP diagnostics)
  })
}
