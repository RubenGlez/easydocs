import { createDB, getAllEndpoints } from '@easydocs/core'
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
    console.error(`Unknown command: ${command}\n\nUsage:\n  easydocs              Start proxy server\n  easydocs export       Export spec to stdout`)
    process.exit(1)
}

// ─── Export ───────────────────────────────────────────────────────────────────

async function runExport(args: string[]) {
  const format = args.includes('--yaml') ? 'yaml' : 'json'
  const db = createDB(process.env.EASYDOCS_DB_URL)
  const endpoints = await getAllEndpoints(db)

  const spec = {
    openapi: '3.0.3',
    info: { title: 'API Documentation', version: '1.0.0' },
    paths: endpoints.reduce<Record<string, Record<string, unknown>>>((acc, e) => {
      if (!e.path || !e.method || !e.spec) return acc
      if (!acc[e.path]) acc[e.path] = {}
      const activeSpec = e.isManuallyEdited && e.manualSpec ? e.manualSpec : e.spec
      acc[e.path][e.method.toLowerCase()] = activeSpec
      return acc
    }, {}),
  }

  if (format === 'yaml') {
    process.stdout.write(yaml.dump(spec))
  } else {
    process.stdout.write(JSON.stringify(spec, null, 2))
  }
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

async function runProxy(args: string[]) {
  const portArg = args.find((a) => a.startsWith('--port='))
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 3999

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
    try {
      responseBody = JSON.parse(responseText)
    } catch {
      responseBody = responseText
    }

    let parsedRequestBody: unknown = null
    if (requestBody?.length) {
      try {
        parsedRequestBody = JSON.parse(requestBody.toString())
      } catch {
        parsedRequestBody = requestBody.toString()
      }
    }

    capture({
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
    console.log(`[EasyDocs] Proxy listening on http://localhost:${port}`)
    console.log(`[EasyDocs] Usage: http://localhost:${port}?target=https://api.example.com/users`)
  })
}
