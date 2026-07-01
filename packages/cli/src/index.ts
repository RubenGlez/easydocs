import { createDB, getAllEndpoints, getEndpointsByProject, findOrCreateProject, buildFullSpec } from '@easydocs/core'
import { createCapturer, parseConfig, diffSpecs, renderDiff, computeDrift, renderDrift } from '@easydocs/core'
import type { HttpMethod } from '@easydocs/core'
import { createServer } from 'http'
import { createRequire } from 'module'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { spawn } from 'child_process'
import yaml from 'js-yaml'

const [,, command, ...args] = process.argv

switch (command) {
  case 'dashboard':
    await runDashboard(args)
    break
  case 'export':
    await runExport(args)
    break
  case 'diff':
    runDiff(args)
    break
  case 'drift':
    await runDrift(args)
    break
  case 'proxy':
  case undefined:
    await runProxy(args)
    break
  default:
    console.error(
      `Unknown command: ${command}\n\nUsage:\n  easydocs [proxy]           Start proxy server\n  easydocs dashboard         Start the docs dashboard\n  easydocs export            Export spec to stdout\n  easydocs diff <a> <b>      Diff two spec files (JSON or YAML)\n  easydocs drift <spec>      Check a committed spec against observed traffic\n\nFlags:\n  --project=<slug>           Scope to a project (default: all)\n  --port=<n>                 Port for proxy (default: 3999) or dashboard (default: 4999)\n  --yaml                     Export as YAML instead of JSON\n  --markdown                 Diff/drift: emit Markdown (for PR comments) instead of plain text\n  --prod                     Dashboard: run next start instead of next dev`
    )
    process.exit(1)
}

function getFlag(args: string[], name: string): string | undefined {
  const entry = args.find((a) => a.startsWith(`--${name}=`))
  return entry?.split('=').slice(1).join('=')
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function findDashboardDir(): string | null {
  // 1. Explicit env var
  if (process.env.EASYDOCS_DASHBOARD_PATH) {
    return process.env.EASYDOCS_DASHBOARD_PATH
  }

  // 2. @easydocs/dashboard installed in the user's project
  try {
    const req = createRequire(join(process.cwd(), 'package.json'))
    const pkgPath = req.resolve('@easydocs/dashboard/package.json')
    return dirname(pkgPath)
  } catch { /* not installed */ }

  // 3. Walk up from cwd — works inside the EasyDocs monorepo
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const candidate = join(dir, 'apps', 'dashboard')
      if (existsSync(join(candidate, 'package.json'))) return candidate
    }
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }

  return null
}

async function runDashboard(args: string[]) {
  const port = parseInt(getFlag(args, 'port') ?? '4999', 10)
  const prod = args.includes('--prod')

  const dashboardDir = findDashboardDir()

  if (!dashboardDir) {
    console.error('[EasyDocs] Dashboard package not found.\n')
    console.error('Install it:')
    console.error('  npm install -D @easydocs/dashboard')
    console.error('  pnpm add -D @easydocs/dashboard\n')
    console.error('Then run:')
    console.error('  npx easydocs dashboard')
    console.error('\nOr set EASYDOCS_DASHBOARD_PATH to your dashboard directory.')
    process.exit(1)
  }

  const nextBin = join(dashboardDir, 'node_modules', '.bin', 'next')
  const cmd = existsSync(nextBin) ? nextBin : 'next'
  const mode = prod ? ['start', '--port', String(port)] : ['dev', '--port', String(port)]

  console.log(`[EasyDocs] Starting dashboard (${prod ? 'production' : 'dev'}) → http://localhost:${port}`)

  const child = spawn(cmd, mode, {
    cwd: dashboardDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, EASYDOCS_DB_URL: process.env.EASYDOCS_DB_URL },
  })

  child.on('exit', (code) => process.exit(code ?? 0))
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function runExport(args: string[]) {
  const format = args.includes('--yaml') ? 'yaml' : 'json'
  const projectSlug = getFlag(args, 'project')
  const db = createDB(process.env.EASYDOCS_DB_URL)

  let endpoints
  if (projectSlug) {
    const projectId = await findOrCreateProject(db, projectSlug)
    endpoints = await getEndpointsByProject(db, projectId)
  } else {
    endpoints = await getAllEndpoints(db)
  }

  const spec = buildFullSpec(endpoints, projectSlug ?? undefined)

  process.stdout.write(format === 'yaml' ? yaml.dump(spec) : JSON.stringify(spec, null, 2))
}

// ─── Diff ───────────────────────────────────────────────────────────────────────

function loadSpecFile(path: string): unknown {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    console.error(`[EasyDocs] Cannot read spec file: ${path}`)
    process.exit(2)
  }
  try {
    // YAML is a superset of JSON, so js-yaml parses both .json and .yaml.
    return yaml.load(raw)
  } catch {
    console.error(`[EasyDocs] Failed to parse spec file (not valid JSON or YAML): ${path}`)
    process.exit(2)
  }
}

function runDiff(args: string[]) {
  const positionals = args.filter((a) => !a.startsWith('--'))
  const [beforePath, afterPath] = positionals
  if (!beforePath || !afterPath) {
    console.error('Usage: easydocs diff <before> <after> [--markdown]')
    process.exit(2)
  }

  const before = loadSpecFile(beforePath)
  const after = loadSpecFile(afterPath)
  const markdown = args.includes('--markdown')

  // Comment-only feature: a diff is informational, so we always exit 0.
  process.stdout.write(renderDiff(diffSpecs(before, after), { markdown }) + '\n')
}

// ─── Drift ────────────────────────────────────────────────────────────────────

// Compare a committed spec against reality: the spec EasyDocs derives from
// observed traffic. With one argument, "reality" is read from the local capture
// DB (like export). With two, both sides come from files (handy for tests/CI).
async function runDrift(args: string[]) {
  const positionals = args.filter((a) => !a.startsWith('--'))
  const [documentedPath, observedPath] = positionals
  if (!documentedPath) {
    console.error('Usage: easydocs drift <spec> [observed-spec] [--project=<slug>] [--markdown]')
    process.exit(2)
  }

  const documented = loadSpecFile(documentedPath)

  let observed: unknown
  if (observedPath) {
    observed = loadSpecFile(observedPath)
  } else {
    const projectSlug = getFlag(args, 'project')
    const db = createDB(process.env.EASYDOCS_DB_URL)
    const endpoints = projectSlug
      ? await getEndpointsByProject(db, await findOrCreateProject(db, projectSlug))
      : await getAllEndpoints(db)
    observed = buildFullSpec(endpoints, projectSlug ?? undefined)
  }

  const markdown = args.includes('--markdown')
  // Drift is an informational signal, never a build gate — always exit 0.
  process.stdout.write(renderDrift(computeDrift(documented, observed), { markdown }) + '\n')
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

async function runProxy(args: string[]) {
  const port = parseInt(getFlag(args, 'port') ?? '3999', 10)
  const projectSlug = getFlag(args, 'project') ?? 'default'
  const capturer = createCapturer(parseConfig({ project: projectSlug }))

  const server = createServer(async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`)
    const targetParam = reqUrl.searchParams.get('target')

    if (!targetParam) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing ?target=<url> query parameter' }))
      return
    }

    let targetUrl: URL
    try {
      targetUrl = new URL(decodeURIComponent(targetParam))
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid target URL' }))
      return
    }

    const method = req.method ?? 'GET'
    const startedAt = Date.now()

    let requestBody: Buffer | undefined
    if (method !== 'GET' && method !== 'HEAD') {
      requestBody = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)
      })
    }

    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers: Object.fromEntries(
        Object.entries(req.headers)
          .filter(([k]) => k !== 'host')
          .map(([k, v]) => [k, String(v)])
      ),
      body: requestBody,
    })

    const responseText = await upstream.text()
    let responseBody: unknown
    try { responseBody = JSON.parse(responseText) } catch { responseBody = responseText }

    let parsedRequestBody: unknown = null
    if (requestBody?.length) {
      try { parsedRequestBody = JSON.parse(requestBody.toString()) } catch { parsedRequestBody = requestBody.toString() }
    }

    capturer.capture({
      method: method as HttpMethod,
      path: targetUrl.pathname,
      query: Object.fromEntries(targetUrl.searchParams.entries()),
      params: {},
      body: parsedRequestBody,
      response: responseBody,
      status: upstream.status,
      requestHeaders: req.headers as Record<string, string>,
      responseHeaders: Object.fromEntries(upstream.headers.entries()),
      durationMs: Date.now() - startedAt,
    })

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()))
    res.end(responseText)
  })

  server.listen(port, () => {
    console.log(`[EasyDocs] Proxy → http://localhost:${port} (project: ${projectSlug})`)
    console.log(`[EasyDocs] Usage: http://localhost:${port}?target=https://api.example.com/users`)
    console.log(`[EasyDocs] Dashboard: npx easydocs dashboard`)
  })
}
