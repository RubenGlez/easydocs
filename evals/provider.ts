import { buildOperation } from '@easydocs/core'
import { readFile } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { CaptureEvent } from '@easydocs/core'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface ProviderContext {
  vars: Record<string, unknown>
}

export async function callApi(_prompt: string, context: ProviderContext) {
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

export const id = 'easydocs-builder'
