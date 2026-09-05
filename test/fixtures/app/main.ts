import { setupChaosWorker, type ChaosConfig } from '../../../src/index.js'

const worker = setupChaosWorker()
const ready = worker.start().then(() => {
  document.querySelector('#status')!.textContent = 'controlled'
})

Object.assign(globalThis, {
  chaosSpike: {
    ready,
    setEnabled: (enabled: boolean) => enabled ? worker.enable() : worker.disable(),
    setConfig: (config: ChaosConfig) => worker.applyConfig(config),
    getState: () => worker.getState(),
    resetScenario: () => worker.resetScenario(),
    request: async (path: string) => {
      const started = performance.now()
      try {
        const response = await fetch(path)
        return {
          status: response.status,
          body: await response.text(),
          duration: performance.now() - started,
        }
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - started,
        }
      }
    },
  },
})
