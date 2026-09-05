/// <reference lib='webworker' />

import { createChaosWorkerRuntime } from './worker.js'

declare const self: ServiceWorkerGlobalScope

const chaos = createChaosWorkerRuntime()
self.addEventListener('install', chaos.onInstall)
self.addEventListener('activate', chaos.onActivate)
self.addEventListener('message', chaos.onMessage)
self.addEventListener('fetch', chaos.onFetch)
