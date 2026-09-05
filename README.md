[![npm version](https://img.shields.io/npm/v/@fetchkit/chaos-sw.svg?style=flat-square)](https://www.npmjs.com/package/@fetchkit/chaos-sw)
[![npm downloads](https://img.shields.io/npm/dm/@fetchkit/chaos-sw.svg?style=flat-square)](https://www.npmjs.com/package/@fetchkit/chaos-sw)
[![GitHub stars](https://img.shields.io/github/stars/fetch-kit/chaos-sw?style=flat-square)](https://github.com/fetch-kit/chaos-sw/stargazers)
[![CI](https://github.com/fetch-kit/chaos-sw/actions/workflows/ci.yaml/badge.svg)](https://github.com/fetch-kit/chaos-sw/actions/workflows/ci.yaml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/fetch-kit/chaos-sw/badge)](https://scorecard.dev/viewer/?uri=github.com/fetch-kit/chaos-sw)

# chaos-sw

> Part of the **[fetch-kit ecosystem](https://fetchkit.org)** - production-ready fetch utilities and chaos-testing tools.

`chaos-sw` is an npm package for injecting failures, latency, rate limits, throttling, and mock responses into browser network requests during development and testing.

It installs a Service Worker that intercepts requests from every controlled browser tab and applies matching [chaos-fetch](https://github.com/fetch-kit/chaos-fetch) middleware. Application code continues using its existing `fetch` calls and HTTP clients; it does not need to call a special fetch wrapper.

Use it when you want to test how a browser application behaves on slow or unreliable networks, against failing endpoints, or with controlled mock responses.

## Features

- Service Worker interception for browser requests
- Global and route-specific chaos rules
- Path-only and exact-origin absolute URL matching
- Built-in latency, failure, rate-limit, throttle, and mock middleware
- One shared configuration across every tab controlled by the worker
- Runtime enable, disable, config replacement, and scenario reset
- Standalone worker or integration with an existing Service Worker
- TypeScript-first ESM package
- No persistence or request logging in the core package

## Installation

```sh
npm install @fetchkit/chaos-sw
```

Copy the standalone worker into the public directory served by your application:

```sh
npx chaos-sw init public
```

The resulting `public/chaos-sw.js` must be served from the root if you want it to control the entire origin.

## Quick Start

```ts
import { setupChaosWorker } from '@fetchkit/chaos-sw'

const chaos = setupChaosWorker({
  workerUrl: '/chaos-sw.js',
  scope: '/',
})

await chaos.start()

await chaos.applyConfig({
  global: [
    { latencyRange: { minMs: 100, maxMs: 500 } },
  ],
  routes: {
    'GET /api/users/:id': [
      { failNth: { n: 3, status: 503 } },
    ],
    'POST https://api.example.com/orders': [
      { failRandomly: { rate: 0.2, status: 500 } },
    ],
  },
})

await chaos.enable()
```

The rules now apply to requests from every controlled tab under the worker scope.

Disable chaos without removing the current rules:

```ts
await chaos.disable()
```

Reset stateful middleware such as `failNth`, `failFirstN`, and `rateLimit`:

```ts
await chaos.resetScenario()
```

## Configuration

chaos-sw accepts the same `ChaosConfig` shape exported by `@fetchkit/chaos-fetch`:

- `global`: ordered middleware applied to every intercepted request
- `routes`: method/path or method/absolute-URL rules
- Path-only routes match the pathname on every origin.
- Absolute URL routes match one exact normalized origin.
- Global middleware runs before matching route middleware.

See the [chaos-fetch middleware documentation](https://github.com/fetch-kit/chaos-fetch#middleware-primitives) for the built-in middleware options.

## Comparison with MSW

Both chaos-sw and [Mock Service Worker](https://mswjs.io/) intercept browser requests through a Service Worker, so application code can keep using its existing HTTP clients. They are designed for different jobs.

| Capability | chaos-sw | MSW |
| --- | --- | --- |
| Primary purpose | Inject network faults and degraded conditions | Mock API behavior and data |
| Configuration model | Serializable global and per-route middleware config | JavaScript/TypeScript request handlers |
| Latency and randomized failures | Built-in chaos primitives | Implement in handler logic |
| Stateful failure scenarios | Built-in `failNth`, `failFirstN`, and rate limiting | Implement with handler state or runtime overrides |
| Response throttling | Built-in | Not the primary abstraction |
| Response mocking | Basic status/body mocking | Rich request-aware response resolvers |
| Protocol support | Fetch requests handled by the browser Service Worker | REST and GraphQL APIs |
| Runtime environments | Browser Service Worker | Browser and Node.js |
| Best fit | Resilience testing against slow, unreliable, or constrained networks | API mocking, frontend development without a backend, and deterministic test data |

Choose chaos-sw when the real or mocked backend should still receive most requests and you want to test failures, latency, bandwidth, or rate limits around that traffic.

Choose MSW when you primarily want to define API behavior and return request-aware test data without depending on a backend.

## Existing Service Workers

Only one Service Worker registration can control a page at a given scope. If the application already has a Service Worker, integrate the chaos runtime into it instead of registering the standalone worker:

```ts
import { createChaosWorkerRuntime } from '@fetchkit/chaos-sw/worker'

const chaos = createChaosWorkerRuntime()

self.addEventListener('install', chaos.onInstall)
self.addEventListener('activate', chaos.onActivate)
self.addEventListener('message', chaos.onMessage)
self.addEventListener('fetch', chaos.onFetch)
```

See [Existing Service Worker Integration](./docs/integration.md) for ordering and coexistence details.

## State and Scope

Configuration and middleware counters live in Service Worker memory. A newly started worker is disabled and has an empty configuration. Your application, test harness, or future DevTools extension must reapply desired state after a worker restart.

State is shared across every controlled tab. Enabling, disabling, applying a config, or resetting a scenario from one tab affects all tabs controlled by that registration.

## Documentation

Detailed guides live in [docs/index.md](./docs/index.md):

- [API Reference](./docs/api.md)
- [Service Worker Integration](./docs/integration.md)
- [Lifecycle, State, and Scope](./docs/lifecycle.md)
- [Testing and Limitations](./docs/testing-and-limitations.md)

## Security and Limitations

- Intended for local development and testing, not production traffic
- Does not persist configuration or middleware state
- Does not include the DevTools extension
- Does not capture request or response bodies
- Subject to normal browser CORS and Service Worker scope rules
- Only structured-cloneable configuration can cross from a page to the worker

## Testing

```sh
npm run typecheck
npm test
npm run build
```

## Join the Community

Have questions, want to discuss features, or share examples? Join the **Fetch-Kit Discord server**:

[Join the Fetch-Kit Discord](https://discord.gg/sdyPBPCDUg)

## License

MIT
