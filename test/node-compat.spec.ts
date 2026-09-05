import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'

const execFileAsync = promisify(execFile)

test('the same published package remains usable in Node ESM', async () => {
  const script = `
    import { createClient } from '@fetchkit/chaos-fetch';
    const client = createClient(
      { routes: { 'GET /node': [{ fail: { status: 502, body: 'node failure' } }] } },
      async () => new Response('upstream', { status: 200 }),
    );
    const failed = await client('https://example.test/node');
    const passed = await client('https://example.test/other');
    console.log(JSON.stringify({
      failedStatus: failed.status,
      failedBody: await failed.text(),
      passedStatus: passed.status,
      passedBody: await passed.text(),
    }));
  `

  const { stdout } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    { cwd: process.cwd() },
  )

  expect(JSON.parse(stdout)).toEqual({
    failedStatus: 502,
    failedBody: 'node failure',
    passedStatus: 200,
    passedBody: 'upstream',
  })
})
