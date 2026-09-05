# Service Worker Integration

chaos-sw can own a standalone Service Worker or run inside a Service Worker already owned by the application.

## Standalone Worker

Install the package and copy its worker asset into the application's public directory:

```sh
npm install @fetchkit/chaos-sw
npx chaos-sw init public
```

Register it from browser application code:

```ts
import { setupChaosWorker } from '@fetchkit/chaos-sw'

const chaos = setupChaosWorker({
  workerUrl: '/chaos-sw.js',
  scope: '/',
})

await chaos.start()
await chaos.applyConfig({
  routes: {
    'GET /api/*path': [
      { latency: { ms: 200 } },
    ],
  },
})
await chaos.enable()
```

### Worker Location and Scope

A Service Worker normally cannot control a scope above the directory containing its script. Serving `/chaos-sw.js` from the origin root allows `scope: '/'`.

If the worker is served from another path, either use a compatible narrower scope or configure the server's `Service-Worker-Allowed` response header.

## Existing Service Worker

A page can only be controlled by one Service Worker registration at a given scope. Do not register the standalone chaos worker over an existing PWA, Workbox, MSW, or application worker.

Import and register the runtime inside the existing worker instead:

```ts
import { createChaosWorkerRuntime } from '@fetchkit/chaos-sw/worker'

const chaos = createChaosWorkerRuntime()

self.addEventListener('install', chaos.onInstall)
self.addEventListener('activate', chaos.onActivate)
self.addEventListener('message', chaos.onMessage)
self.addEventListener('fetch', chaos.onFetch)
```

Register the chaos fetch listener before another listener that may call `respondWith()`. When chaos is enabled, it owns the response for intercepted requests. When disabled, it returns without calling `respondWith()`.

## Custom Upstream Fetch

The runtime can delegate pass-through requests to a custom fetch-compatible function. This is the integration point for an existing cache or routing strategy:

```ts
const chaos = createChaosWorkerRuntime({
  fetch: request => cacheFirst(request),
})
```

chaos-fetch middleware runs around this function. A mock or failure middleware may short-circuit it; otherwise it supplies the upstream response.

## Updating the Worker Asset

Run the initializer again after updating `@fetchkit/chaos-sw`:

```sh
npx chaos-sw init public
```

The initializer replaces the existing `chaos-sw.js`. The new worker starts disabled with an empty configuration after activation, so the controlling application must reapply desired state.

## Troubleshooting

### The page is not controlled

- Confirm the page and worker use HTTPS, except for localhost development.
- Confirm the worker URL returns JavaScript instead of an HTML fallback.
- Confirm the requested scope is allowed by the worker URL or response header.
- Check for another Service Worker registration at the same scope.
- Reload after fixing a previously failed or unrelated registration.

### Commands time out

The current controller may not be chaos-sw. Inspect the registration in browser developer tools and confirm that the installed script is the expected standalone worker or contains the integrated runtime.

### Rules do not match

- Path-only rules match every origin by pathname.
- Absolute URL rules require the exact protocol, hostname, and non-default port.
- Query strings and fragments do not participate in route matching.
- The first matching route wins.

