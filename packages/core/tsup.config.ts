import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'storage/schema': 'src/storage/schema.ts',
    dashboard: 'src/dashboard.ts',
  },
  format: ['esm', 'cjs'],
  dts: { resolve: true },
  sourcemap: true,
  clean: true,
})
