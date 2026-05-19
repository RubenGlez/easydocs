import type { NextConfig } from 'next'

const config: NextConfig = {
  transpilePackages: ['@easydocs/core'],
  serverExternalPackages: ['@libsql/client', 'libsql', 'better-sqlite3'],
  webpack(webpackConfig, { isServer }) {
    if (isServer) {
      const existing = Array.isArray(webpackConfig.externals) ? webpackConfig.externals : []
      webpackConfig.externals = [
        ...existing,
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          if (request && /^(libsql|@libsql\/)/.test(request)) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return webpackConfig
  },
}

export default config
