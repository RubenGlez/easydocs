import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'storage/schema': 'src/storage/schema.ts',
    'spec/schema': 'src/spec/schema.ts',
    'spec/diff': 'src/spec/diff.ts',
    dashboard: 'src/dashboard.ts',
  },
  format: ['esm', 'cjs'],
  dts: { resolve: true },
  sourcemap: true,
  clean: true,
})
