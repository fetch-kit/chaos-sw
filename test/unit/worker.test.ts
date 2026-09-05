/// <reference lib='webworker' />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createChaosWorkerRuntime } from '../../src/worker.js'
import type { ChaosWorkerCommand } from '../../src/protocol.js'

const SCOPE = 'http://localhost/'

const skipWaiting = vi.fn(() => Promise.resolve())
const claim = vi.fn(() => Promise.resolve())

beforeEach(() => {
  skipWaiting.mockClear()
  claim.mockClear()
  Object.defineProperty(globalThis, 'self', {
    configurable: true,
    writable: true,
    value: {
      registration: { scope: SCOPE },
      skipWaiting,
      clients: { claim },
    },
  })
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'self')
})

const command = (
  type: ChaosWorkerCommand['type'],
  extra: Record<string, unknown> = {},
): ChaosWorkerCommand => ({ id: 'cmd-1', type, ...extra }) as ChaosWorkerCommand

const okResponse = () => new Response('{"ok":true}', { status: 200 })

const fetchEvent = (url = 'http://localhost/api') => {
  const responses: Promise<Response>[] = []
  return {
    request: new Request(url),
    respondWith: vi.fn((value: Promise<Response>) => responses.push(value)),
    response: () => responses[0],
  }
}

describe('createChaosWorkerRuntime', () => {
  describe('state', () => {
    it('starts disabled, at version zero, and reports the registration scope', () => {
      const runtime = createChaosWorkerRuntime()
      expect(runtime.getState()).toEqual({ enabled: false, version: 0, scope: SCOPE })
    })

    it('honours the initially enabled option', () => {
      const runtime = createChaosWorkerRuntime({ initiallyEnabled: true })
      expect(runtime.getState().enabled).toBe(true)
    })
  })

  describe('handleCommand', () => {
    it('answers ping and state:get without changing the version', () => {
      const runtime = createChaosWorkerRuntime()

      expect(runtime.handleCommand(command('ping'))).toEqual({
        id: 'cmd-1',
        ok: true,
        state: { enabled: false, version: 0, scope: SCOPE },
      })
      expect(runtime.handleCommand(command('state:get')).state.version).toBe(0)
    })

    it('enables and disables chaos, bumping the version each time', () => {
      const runtime = createChaosWorkerRuntime()

      expect(runtime.handleCommand(command('chaos:enable')).state).toMatchObject({
        enabled: true,
        version: 1,
      })
      expect(runtime.handleCommand(command('chaos:disable')).state).toMatchObject({
        enabled: false,
        version: 2,
      })
    })

    it('rejects an unknown command without changing state', () => {
      const runtime = createChaosWorkerRuntime()
      const response = runtime.handleCommand(command('nonsense' as ChaosWorkerCommand['type']))

      expect(response).toMatchObject({ id: 'cmd-1', ok: false, error: 'Unknown chaos-sw command' })
      expect(response.state.version).toBe(0)
    })

    it('reports the failure and keeps the id when a config cannot be built', () => {
      const runtime = createChaosWorkerRuntime()
      const response = runtime.handleCommand(
        command('config:apply', { config: { global: [{ notAMiddleware: {} }] } }),
      )

      expect(response.ok).toBe(false)
      expect(response.id).toBe('cmd-1')
      expect(response).toHaveProperty('error', expect.stringContaining('notAMiddleware'))
    })
  })

  describe('config rebuild', () => {
    it('applies a new config to subsequent requests', async () => {
      const baseFetch = vi.fn(async () => okResponse())
      const runtime = createChaosWorkerRuntime({ fetch: baseFetch, initiallyEnabled: true })

      runtime.handleCommand(
        command('config:apply', { config: { global: [{ fail: { status: 503 } }] } }),
      )

      const event = fetchEvent()
      runtime.onFetch(event as unknown as FetchEvent)

      expect((await event.response()).status).toBe(503)
      expect(baseFetch).not.toHaveBeenCalled()
    })

    it('falls back to pass-through when a config fails to build', async () => {
      const baseFetch = vi.fn(async () => okResponse())
      const runtime = createChaosWorkerRuntime({
        fetch: baseFetch,
        initialConfig: { global: [{ fail: { status: 503 } }] },
        initiallyEnabled: true,
      })

      const failing = fetchEvent()
      runtime.onFetch(failing as unknown as FetchEvent)
      expect((await failing.response()).status).toBe(503)

      const response = runtime.handleCommand(
        command('config:apply', { config: { global: [{ notAMiddleware: {} }] } }),
      )
      expect(response.ok).toBe(false)

      const afterFailure = fetchEvent()
      runtime.onFetch(afterFailure as unknown as FetchEvent)

      expect((await afterFailure.response()).status).toBe(200)
      expect(baseFetch).toHaveBeenCalledTimes(1)
    })

    it('resets stateful middleware counters on scenario:reset', async () => {
      const baseFetch = vi.fn(async () => okResponse())
      const runtime = createChaosWorkerRuntime({
        fetch: baseFetch,
        initialConfig: { global: [{ failFirstN: { n: 1, status: 500 } }] },
        initiallyEnabled: true,
      })

      const first = fetchEvent()
      runtime.onFetch(first as unknown as FetchEvent)
      expect((await first.response()).status).toBe(500)

      const second = fetchEvent()
      runtime.onFetch(second as unknown as FetchEvent)
      expect((await second.response()).status).toBe(200)

      expect(runtime.handleCommand(command('scenario:reset')).ok).toBe(true)

      const afterReset = fetchEvent()
      runtime.onFetch(afterReset as unknown as FetchEvent)
      expect((await afterReset.response()).status).toBe(500)
    })
  })

  describe('onFetch', () => {
    it('declines to handle the request while disabled', () => {
      const runtime = createChaosWorkerRuntime({ fetch: vi.fn(async () => okResponse()) })
      const event = fetchEvent()

      expect(runtime.onFetch(event as unknown as FetchEvent)).toBe(false)
      expect(event.respondWith).not.toHaveBeenCalled()
    })

    it('handles the request while enabled', () => {
      const runtime = createChaosWorkerRuntime({
        fetch: vi.fn(async () => okResponse()),
        initiallyEnabled: true,
      })
      const event = fetchEvent()

      expect(runtime.onFetch(event as unknown as FetchEvent)).toBe(true)
      expect(event.respondWith).toHaveBeenCalledOnce()
    })
  })

  describe('onMessage', () => {
    it('replies on the transferred port', () => {
      const runtime = createChaosWorkerRuntime()
      const port = { postMessage: vi.fn() }

      runtime.onMessage({
        data: command('chaos:enable'),
        ports: [port],
      } as unknown as ExtendableMessageEvent)

      expect(port.postMessage).toHaveBeenCalledWith({
        id: 'cmd-1',
        ok: true,
        state: { enabled: true, version: 1, scope: SCOPE },
      })
    })

    it('drops the message when no port is transferred', () => {
      const runtime = createChaosWorkerRuntime()

      runtime.onMessage({
        data: command('chaos:enable'),
        ports: [],
      } as unknown as ExtendableMessageEvent)

      expect(runtime.getState().version).toBe(0)
    })

    it.each([
      ['the payload is missing', null],
      ['the payload is not an object', 'ping'],
    ])('drops the message when %s', (_label, data) => {
      const runtime = createChaosWorkerRuntime()
      const port = { postMessage: vi.fn() }

      runtime.onMessage({ data, ports: [port] } as unknown as ExtendableMessageEvent)

      expect(port.postMessage).not.toHaveBeenCalled()
      expect(runtime.getState().version).toBe(0)
    })
  })

  describe('lifecycle', () => {
    it('skips waiting on install and claims clients on activate', () => {
      const runtime = createChaosWorkerRuntime()
      const waitUntil = vi.fn()

      runtime.onInstall({ waitUntil } as unknown as ExtendableEvent)
      expect(skipWaiting).toHaveBeenCalledOnce()

      runtime.onActivate({ waitUntil } as unknown as ExtendableEvent)
      expect(claim).toHaveBeenCalledOnce()

      expect(waitUntil).toHaveBeenCalledTimes(2)
    })
  })
})
