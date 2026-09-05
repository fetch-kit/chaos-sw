import path from 'node:path'
import { expect, test } from '@playwright/test'
import { build } from 'esbuild'

test('bundles chaos-fetch for a browser Service Worker without shims', async () => {
  const result = await build({
    entryPoints: [path.resolve('src/standalone-worker.ts')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false,
    logLevel: 'silent',
  })

  expect(result.outputFiles).toHaveLength(1)
  expect(result.outputFiles[0].text).toContain('createChaosWorkerRuntime')
})
