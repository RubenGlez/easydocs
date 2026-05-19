import { buildOperation } from '@easydocs/core'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { CaptureEvent } from '@easydocs/core'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default class EasyDocsProvider {
  id() {
    return 'easydocs-builder'
  }

  async callApi(_prompt: string, context: { vars: Record<string, unknown> }) {
    const fixturePath = resolve(__dirname, String(context.vars.fixture))
    const raw = await readFile(fixturePath, 'utf8')
    const fixture = JSON.parse(raw) as CaptureEvent

    try {
      const spec = await buildOperation(fixture, null)
      return { output: JSON.stringify(spec, null, 2) }
    } catch (err) {
      return { error: String(err) }
    }
  }
}
