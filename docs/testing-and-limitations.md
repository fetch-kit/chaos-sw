# Testing and Limitations

chaos-sw is intended for local development, automated browser testing, and controlled resilience exercises.

## Recommended Test Setup

Install the standalone worker into the test application's public directory:

```sh
npx chaos-sw init public
```

Initialize it before the test scenario:

```ts
const chaos = setupChaosWorker()
await chaos.start()
await chaos.applyConfig(config)
await chaos.enable()
```

Clean up scenario state between tests:

```ts
await chaos.disable()
await chaos.applyConfig({})
```

Use `resetScenario()` when a test needs to rerun the same stateful rules without replacing the config.

## Multi-Tab Tests

All tabs controlled by the same registration share one enabled state, config, and middleware state. Tests running in parallel against the same browser origin can interfere with each other.

Use one of these isolation strategies:

- run chaos scenarios serially
- give each test worker a different origin or port
- use separate browser contexts with isolated Service Worker storage
- apply and reset config explicitly around each test

## Global Rules

A global rule affects every request intercepted under the worker scope, not only API requests. This can include documents, scripts, stylesheets, images, and cross-origin fetches initiated by controlled pages.

Prefer route-specific rules when page assets and navigation should remain unaffected.

## Browser Constraints

- Service Workers require a secure context, with localhost exceptions for development.
- Normal CORS and Fetch rules still apply.
- Cross-origin responses may be opaque depending on request mode and server headers.
- A worker can only control clients within its allowed scope.
- Only one Service Worker registration controls a page at a given scope.
- Browser lifecycle management may restart workers at any time.

## Serializable Configuration

The page controller sends config through `postMessage`, so values must be supported by the structured clone algorithm.

Functions cannot cross this boundary. For example, a function-valued `rateLimit.key` cannot be applied from page code. Use serializable built-in options, or configure function-valued behavior directly inside an integrated Service Worker.

## Persistence and Observability

The core package deliberately does not:

- persist config or enabled state
- persist middleware counters
- load YAML
- provide a configuration editor
- capture or display requests and responses

Use the browser Network panel for request inspection. Persistence and configuration editing are the responsibility of the surrounding application or test harness.

## Production Use

Do not ship chaos enabled in production. If the package is present in a production build, gate registration and activation behind an explicit development or test condition.

