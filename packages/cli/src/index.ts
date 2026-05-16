import { createDB, getAllEndpoints, getEndpointsByProject, findOrCreateProject } from '@easydocs/core'
import { capture } from '@easydocs/core'
import type { HttpMethod } from '@easydocs/core'
import { createServer } from 'http'
import yaml from 'js-yaml'

const [,, command, ...args] = process.argv

switch (command) {
  case 'export':
    await runExport(args)
    break
  case 'proxy':
  case undefined:
    await runProxy(args)
    break
  default:
    console.error(
      `Unknown command: ${command}\n\nUsage:\n  easydocs [proxy]           Start proxy server\n  easydocs export            Export spec to stdout\n\nFlags:\n  --project=<slug>           Scope to a project (default: all)\n  --port=<n>                 Port for proxy server (default: 3999)\n  --yaml                     Export as YAML instead of JSON`
    )
    process.exit(1)
}

function getFlag(args: string[], name: string): string | undefined {
  const entry = args.find((a) => a.startsWith(`--${name}=`))
  return entry?.split('=').slice(1).join('=')
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

  const spec = {
    openapi: '3.0.3',
    info: { title: projectSlug ?? 'API Documentation', version: '1.0.0' },
    paths: endpoints.reduce<Record<string, Record<string, unknown>>>((acc, e) => {
      if (!e.path || !e.method) return acc
      const activeSpec = e.isManuallyEdited && e.manualSpec ? e.manualSpec : e.spec
      if (!activeSpec) return acc
      if (!acc[e.path]) acc[e.path] = {}
      acc[e.path][e.method.toLowerCase()] = activeSpec
      return acc
    }, {}),
  }

  process.stdout.write(format === 'yaml' ? yaml.dump(spec) : JSON.stringify(spec, null, 2))
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

async function runProxy(args: string[]) {
  const port = parseInt(getFlag(args, 'port') ?? '3999', 10)
  const projectSlug = getFlag(args, 'project') ?? 'default'

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

    capture(
      {
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
      },
      { project: projectSlug }
    )

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()))
    res.end(responseText)
  })

  server.listen(port, () => {
    console.log(`[EasyDocs] Proxy → http://localhost:${port} (project: ${projectSlug})`)
    console.log(`[EasyDocs] Usage: http://localhost:${port}?target=https://api.example.com/users`)
  })
}
