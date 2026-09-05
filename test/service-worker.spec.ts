import { expect, test, type Page } from '@playwright/test'

type ChaosConfig = {
  global?: Array<Record<string, unknown>>
  routes?: Record<string, Array<Record<string, unknown>>>
}

async function ready(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => document.querySelector('#status')?.textContent === 'controlled')
}

async function command(page: Page, method: 'setEnabled' | 'setConfig', value: boolean | ChaosConfig) {
  return page.evaluate(
    ({ method, value }) => (globalThis as any).chaosSpike[method](value),
    { method, value },
  )
}

async function request(page: Page, path: string) {
  return page.evaluate(path => (globalThis as any).chaosSpike.request(path), path) as Promise<{
    status?: number
    body?: string
    error?: string
    duration: number
  }>
}

test.beforeEach(async ({ page }) => {
  await ready(page)
  await command(page, 'setEnabled', false)
  await command(page, 'setConfig', {})
  await command(page, 'setEnabled', true)
})

test('loads the npm package in a Service Worker and passes through without recursion', async ({ page }) => {
  const result = await request(page, '/api/passthrough')
  expect(result.error).toBeUndefined()
  expect(result.status).toBe(200)
  expect(JSON.parse(result.body!)).toMatchObject({ ok: true, path: '/passthrough' })
})

test('applies global latency', async ({ page }) => {
  await command(page, 'setConfig', {
    global: [{ latency: { ms: 120 } }],
  })

  const result = await request(page, '/api/latency')
  expect(result.status).toBe(200)
  expect(result.duration).toBeGreaterThanOrEqual(95)
})

test('applies route-specific failure and leaves unmatched routes alone', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/fail': [{ fail: { status: 503, body: 'planned failure' } }],
    },
  })

  const failed = await request(page, '/api/fail')
  const passed = await request(page, '/api/pass')
  expect(failed).toMatchObject({ status: 503, body: 'planned failure' })
  expect(passed.status).toBe(200)
})

test('supports mock responses', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/mock': [{ mock: { status: 201, body: 'mocked' } }],
    },
  })

  await expect(request(page, '/api/mock')).resolves.toMatchObject({ status: 201, body: 'mocked' })
})

test('supports rate limiting', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/limited': [{ rateLimit: { limit: 1, windowMs: 60_000 } }],
    },
  })

  expect((await request(page, '/api/limited')).status).toBe(200)
  expect((await request(page, '/api/limited')).status).toBe(429)
})

test('supports Web Stream response throttling', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/large': [{ throttle: { rate: 10_240, chunkSize: 512 } }],
    },
  })

  const result = await request(page, '/api/large')
  expect(result.status).toBe(200)
  expect(result.body).toHaveLength(2048)
  expect(result.duration).toBeGreaterThanOrEqual(150)
})

test('replacing the handler resets stateful middleware', async ({ page }) => {
  const config = {
    routes: {
      'GET /api/stateful': [{ failFirstN: { n: 1, status: 503 } }],
    },
  }

  await command(page, 'setConfig', config)
  expect((await request(page, '/api/stateful')).status).toBe(503)
  expect((await request(page, '/api/stateful')).status).toBe(200)

  await command(page, 'setConfig', config)
  expect((await request(page, '/api/stateful')).status).toBe(503)
})

test('resetScenario rebuilds the current handler', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/reset': [{ failFirstN: { n: 1, status: 503 } }],
    },
  })

  expect((await request(page, '/api/reset')).status).toBe(503)
  expect((await request(page, '/api/reset')).status).toBe(200)
  await page.evaluate(() => (globalThis as any).chaosSpike.resetScenario())
  expect((await request(page, '/api/reset')).status).toBe(503)
})

test('supports exact-origin absolute URL routes', async ({ page }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET http://127.0.0.1:4173/api/absolute': [{ fail: { status: 521 } }],
    },
  })

  expect((await request(page, '/api/absolute')).status).toBe(521)
})

test('enable and disable state applies to every controlled tab', async ({ page, context }) => {
  await command(page, 'setConfig', {
    routes: {
      'GET /api/all-tabs': [{ fail: { status: 529, body: 'all tabs' } }],
    },
  })

  const secondPage = await context.newPage()
  await ready(secondPage)
  expect((await request(secondPage, '/api/all-tabs')).status).toBe(529)

  await command(secondPage, 'setEnabled', false)
  expect((await request(page, '/api/all-tabs')).status).toBe(200)
})
