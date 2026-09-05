# API Reference

## Imports

The page-side controller is exported from the package root:

```ts
import {
  setupChaosWorker,
  type ChaosConfig,
  type ChaosWorkerController,
  type ChaosWorkerState,
  type SetupChaosWorkerOptions,
} from '@fetchkit/chaos-sw'
```

The worker runtime has a separate entry point:

```ts
import {
  createChaosWorkerRuntime,
  type ChaosWorkerRuntime,
  type ChaosWorkerRuntimeOptions,
} from '@fetchkit/chaos-sw/worker'
```

## setupChaosWorker(options?)

Creates a page-side controller for registering and communicating with the Service Worker.

```ts
const chaos = setupChaosWorker({
  workerUrl: '/chaos-sw.js',
  scope: '/',
  timeoutMs: 5000,
})
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `workerUrl` | `string \| URL` | `/chaos-sw.js` | URL of the standalone worker asset |
| `scope` | `string` | `/` | Service Worker registration scope |
| `timeoutMs` | `number` | `5000` | Timeout for worker control and commands |

The worker URL location limits the maximum allowed scope unless the server sends an appropriate `Service-Worker-Allowed` header. Serve the worker from the application root when using root scope.

## ChaosWorkerController

### start()

```ts
const state = await chaos.start()
```

Registers the configured worker, waits for the Service Worker registration to become ready and for a worker to control the page, then confirms communication with it.

Calling `start()` does not enable chaos or apply a configuration.

### getState()

```ts
const state = await chaos.getState()
```

Returns the current worker state.

### applyConfig(config)

```ts
await chaos.applyConfig({
  routes: {
    'GET /api/health': [
      { fail: { status: 503, body: 'Unavailable' } },
    ],
  },
})
```

Builds a new chaos-fetch handler and atomically replaces the active handler. Applying a config resets all stateful middleware.

If handler construction fails, the worker installs an empty handler and rejects the command. The previous handler is not retained.

### enable()

Enables the active handler for every request intercepted by this Service Worker registration.

### disable()

Disables chaos interception without deleting the active configuration. Requests then continue through the browser normally.

### resetScenario()

Rebuilds the active config, resetting middleware counters and other in-memory scenario state.

## ChaosWorkerState

```ts
interface ChaosWorkerState {
  enabled: boolean
  version: number
  scope: string
}
```

- `enabled`: whether intercepted requests currently pass through chaos-fetch
- `version`: in-memory state revision
- `scope`: scope of the active Service Worker registration

The version is diagnostic state, not a persistence or concurrency contract. It resets when the worker restarts.

## createChaosWorkerRuntime(options?)

Creates event handlers for use inside a Service Worker.

```ts
const chaos = createChaosWorkerRuntime({
  initialConfig: {},
  initiallyEnabled: false,
})
```

### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `fetch` | `typeof fetch` | Worker global fetch | Upstream fetch implementation |
| `initialConfig` | `ChaosConfig` | `{}` | Initial in-memory chaos config |
| `initiallyEnabled` | `boolean` | `false` | Initial enabled state |

The returned runtime exposes:

- `onInstall(event)`
- `onActivate(event)`
- `onMessage(event)`
- `onFetch(event)`
- `getState()`
- `handleCommand(command)`

Use the event handlers directly with `self.addEventListener`. The lower-level state and command methods are mainly useful for integration and testing.

## Configuration Types

`ChaosConfig` and `MiddlewareConfig` are re-exported from `@fetchkit/chaos-fetch`. Refer to the [chaos-fetch documentation](https://github.com/fetch-kit/chaos-fetch#configuration) for route matching and middleware configuration.

