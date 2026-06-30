// Deterministic PII / secret detection rules. No AI, no network — these run
// identically offline. Detection must be deterministic precisely because its job
// is to keep sensitive values away from hosted AI providers; you cannot use the
// model to decide what to withhold from the model. See ADR 0009.

/** Lowercase and strip non-alphanumerics so api_key / apiKey / API-Key all match. */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Built-in sensitive key names, normalized. Matched as exact normalized keys. */
export const SENSITIVE_KEY_NAMES: ReadonlySet<string> = new Set(
  [
    'password',
    'passwd',
    'secret',
    'token',
    'apiKey',
    'accessToken',
    'refreshToken',
    'clientSecret',
    'ssn',
    'creditCard',
    'cardNumber',
    'cvv',
    'authorization',
  ].map(normalizeKey)
)

/** Header names whose value is always redacted, compared case-insensitively. */
export const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'set-cookie',
])

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const API_KEY_PREFIX = /^(sk-|ghp_|AKIA|xoxb-)/

/** Validate a candidate card number with the Luhn checksum. */
export function luhnValid(input: string): boolean {
  const digits = input.replace(/[\s-]/g, '')
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** True when a string value looks like a secret/PII by its shape alone. */
export function matchesSensitiveValue(value: string, extraPatterns: readonly RegExp[] = []): boolean {
  const v = value.trim()
  if (EMAIL.test(v)) return true
  if (JWT.test(v)) return true
  if (API_KEY_PREFIX.test(v)) return true
  if (luhnValid(v)) return true
  return extraPatterns.some((p) => p.test(value))
}
