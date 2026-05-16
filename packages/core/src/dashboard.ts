import { spawn } from 'child_process'
import { createServer } from 'net'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

let started = false

function isPortTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = createServer()
      .once('error', () => resolve(true))
      .once('listening', () => tester.close(() => resolve(false)))
      .listen(port, '127.0.0.1')
  })
}

function locateDashboard(fromDir: string): string | null {
  let dir = fromDir
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const candidate = join(dir, 'apps', 'dashboard')
      if (existsSync(join(candidate, 'package.json'))) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

export async function maybeStartDashboard(port = 4999): Promise<void> {
  if (started) return
  started = true

  if (process.env.NODE_ENV !== 'development') return

  const alreadyRunning = await isPortTaken(port)
  if (alreadyRunning) return

  const explicitPath = process.env.EASYDOCS_DASHBOARD_PATH
  let dashboardDir = explicitPath ?? null

  if (!dashboardDir) {
    const thisFile = fileURLToPath(import.meta.url)
    dashboardDir = locateDashboard(dirname(thisFile))
  }

  if (!dashboardDir) {
    console.log('[EasyDocs] Dashboard not found. Set EASYDOCS_DASHBOARD_PATH or run it manually.')
    return
  }

  const nextBin = join(dashboardDir, 'node_modules', '.bin', 'next')
  const cmd = existsSync(nextBin) ? nextBin : 'next'

  const child = spawn(cmd, ['dev', '--port', String(port)], {
    cwd: dashboardDir,
    stdio: 'ignore',
    detached: true,
    shell: process.platform === 'win32',
  })

  child.unref()
  console.log(`[EasyDocs] Dashboard → http://localhost:${port}`)
}
