import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/worker.ts'],
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist',
    clean: true,
    bundle: true,
    dts: true,
    noExternal: ['@fetchkit/chaos-fetch'],
  },
  {
    entry: { 'chaos-sw': 'src/standalone-worker.ts' },
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    outDir: 'public',
    clean: true,
    bundle: true,
    noExternal: ['@fetchkit/chaos-fetch'],
  },
])
