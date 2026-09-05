/// <reference lib='webworker' />

import { createClient, type ChaosConfig } from '@fetchkit/chaos-fetch'
import {
  type ChaosWorkerCommand,
  type ChaosWorkerResponse,
  type ChaosWorkerState,
} from './protocol.js'

export interface ChaosWorkerRuntimeOptions {
  fetch?: typeof fetch
  initialConfig?: ChaosConfig
  initiallyEnabled?: boolean
}

export interface ChaosWorkerRuntime {
  getState(): ChaosWorkerState
  handleCommand(command: ChaosWorkerCommand): ChaosWorkerResponse
  onInstall(event: ExtendableEvent): void
  onActivate(event: ExtendableEvent): void
  onMessage(event: ExtendableMessageEvent): void
  onFetch(event: FetchEvent): boolean
}

export function createChaosWorkerRuntime(
  options: ChaosWorkerRuntimeOptions = {},
): ChaosWorkerRuntime {
  const workerGlobal = self as unknown as ServiceWorkerGlobalScope
  const baseFetch: typeof fetch = options.fetch ?? globalThis.fetch
  let config = options.initialConfig ?? {}
  let enabled = options.initiallyEnabled ?? false
  let version = 0
  let chaosFetch = createClient(config, baseFetch)

  const getState = (): ChaosWorkerState => ({
    enabled,
    version,
    scope: workerGlobal.registration.scope,
  })

  const rebuild = (nextConfig: ChaosConfig): void => {
    try {
      const next = createClient(nextConfig, baseFetch)
      config = nextConfig
      chaosFetch = next
      version += 1
    } catch (error) {
      config = {}
      chaosFetch = createClient({}, baseFetch)
      version += 1
      throw error
    }
  }

  const handleCommand = (command: ChaosWorkerCommand): ChaosWorkerResponse => {
    try {
      switch (command.type) {
        case 'ping':
        case 'state:get':
          break
        case 'chaos:enable':
          enabled = true
          version += 1
          break
        case 'chaos:disable':
          enabled = false
          version += 1
          break
        case 'config:apply':
          rebuild(command.config)
          break
        case 'scenario:reset':
          rebuild(config)
          break
        default:
          throw new Error('Unknown chaos-sw command')
      }
      return { id: command.id, ok: true, state: getState() }
    } catch (error) {
      return {
        id: command.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        state: getState(),
      }
    }
  }

  return {
    getState,
    handleCommand,
    onInstall: event => event.waitUntil(workerGlobal.skipWaiting()),
    onActivate: event => event.waitUntil(workerGlobal.clients.claim()),
    onMessage(event) {
      const port = event.ports[0]
      if (!port || !event.data || typeof event.data !== 'object') return
      port.postMessage(handleCommand(event.data as ChaosWorkerCommand))
    },
    onFetch(event) {
      if (!enabled) return false
      event.respondWith(chaosFetch(event.request))
      return true
    },
  }
}
