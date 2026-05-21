import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@easydocs/core'],
  serverExternalPackages: ['@libsql/client', 'libsql', 'better-sqlite3'],
  turbopack: {},
}

export default config
