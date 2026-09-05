import type { ChaosConfig } from '@fetchkit/chaos-fetch'
import {
  isChaosWorkerResponse,
  type ChaosWorkerCommand,
  type ChaosWorkerCommandInput,
  type ChaosWorkerState,
} from './protocol.js'

export type { ChaosConfig, MiddlewareConfig } from '@fetchkit/chaos-fetch'
export {
  type ChaosWorkerCommand,
  type ChaosWorkerResponse,
  type ChaosWorkerState,
} from './protocol.js'

export interface SetupChaosWorkerOptions {
  workerUrl?: string | URL
  scope?: string
  timeoutMs?: number
}

export interface ChaosWorkerController {
  start(): Promise<ChaosWorkerState>
  getState(): Promise<ChaosWorkerState>
  enable(): Promise<ChaosWorkerState>
  disable(): Promise<ChaosWorkerState>
  applyConfig(config: ChaosConfig): Promise<ChaosWorkerState>
  resetScenario(): Promise<ChaosWorkerState>
}

export function setupChaosWorker(options: SetupChaosWorkerOptions = {}): ChaosWorkerController {
  const timeoutMs = options.timeoutMs ?? 5000

  const controlledWorker = (): ServiceWorker => {
    const worker = navigator.serviceWorker.controller
    if (!worker) throw new Error('The page is not controlled by the chaos Service Worker')
    return worker
  }

  const send = async (
    command: ChaosWorkerCommandInput,
  ): Promise<ChaosWorkerState> => {
    const id = crypto.randomUUID()
    const message = { ...command, id } as ChaosWorkerCommand

    return new Promise((resolve, reject) => {
      const channel = new MessageChannel()
      const timeout = setTimeout(() => reject(new Error('chaos-sw command timed out')), timeoutMs)
      channel.port1.onmessage = event => {
        clearTimeout(timeout)
        if (!isChaosWorkerResponse(event.data) || event.data.id !== id) {
          reject(new Error('Invalid response from the chaos Service Worker'))
        } else if (!event.data.ok) {
          reject(new Error(event.data.error))
        } else {
          resolve(event.data.state)
        }
      }
      controlledWorker().postMessage(message, [channel.port2])
    })
  }

  const waitForController = async (): Promise<void> => {
    if (navigator.serviceWorker.controller) return
    await new Promise<void>((resolve, reject) => {
      const onChange = () => {
        clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('controllerchange', onChange)
        resolve()
      }
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', onChange)
        reject(new Error('The chaos Service Worker did not take control of the page'))
      }, timeoutMs)
      navigator.serviceWorker.addEventListener('controllerchange', onChange)
    })
  }

  return {
    async start() {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Workers are not supported in this browser')
      }
      await navigator.serviceWorker.register(options.workerUrl ?? '/chaos-sw.js', {
        scope: options.scope ?? '/',
        type: 'module',
        updateViaCache: 'none',
      })
      await navigator.serviceWorker.ready
      await waitForController()
      return send({ type: 'ping' })
    },
    getState: () => send({ type: 'state:get' }),
    enable: () => send({ type: 'chaos:enable' }),
    disable: () => send({ type: 'chaos:disable' }),
    applyConfig: config => send({ type: 'config:apply', config }),
    resetScenario: () => send({ type: 'scenario:reset' }),
  }
}
