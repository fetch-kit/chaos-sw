# chaos-sw implementation plan

## Goal

Build `@fetchkit/chaos-sw`, a browser-focused chaos-testing package that intercepts requests in a Service Worker, reuses the Fetch-native engine from `@fetchkit/chaos-fetch`, and includes a browser DevTools extension for loading, editing, and applying YAML rulesets.

V1 uses one active ruleset per Service Worker origin and scope. Enabling chaos affects every controlled tab in that origin and scope. Route-specific behavior belongs in the ruleset. Stateful middleware state remains in memory and may reset when the browser restarts the worker or when a ruleset is reapplied.

## Guiding decisions

- Do not create a common core shared with `chaos-proxy`.
- Treat `chaos-fetch` as the Fetch-native chaos engine.
- Keep Service Worker lifecycle and runtime messaging in the `chaos-sw` npm package.
- Keep YAML parsing, draft/saved state, and persistence in the DevTools extension.
- Keep the DevTools extension in the `chaos-sw` repository, with a separate build artifact from the npm package.
- Persist raw YAML content and its display filename. Do not rely on reopening a local file by filename.
- Applying a valid document atomically replaces the active handler.
- Applying an invalid document saves the YAML for correction and activates an empty ruleset, with a prominent error state.
- Do not capture request or response bodies by default.
- Support a standalone worker and an integration API for applications that already own a Service Worker.

## Proposed repository layout

```text
chaos-sw/
  package.json
  tsconfig.json
  tsup.config.ts
  README.md
  plan.md
  src/
    index.ts                 # page-side public API
    worker.ts                # worker-side public API
    protocol.ts              # serializable commands/events
    runtime/
      controller.ts
      fetch-listener.ts
      bypass.ts
    standalone-worker.ts     # standalone worker entry
    extension/
      manifest.json
      devtools.html
      devtools.ts
      background.ts
      content.ts
      bridge.ts
      config/
        parse.ts
        validate.ts
      persistence/
        store.ts
      panel/
        index.html
        main.ts
        styles.css
        editor.ts
        state.ts
  test/
    unit/
    integration/
    browser/
    fixtures/
  examples/
    vanilla/
    existing-worker/
```

If the extension becomes independently complex, introduce npm workspaces later. Do not start with a monorepo split unless separate build tooling requires it.

# 1. chaos-fetch prerequisites â€” completed

`@fetchkit/chaos-fetch@1.3.0` contains all prerequisites required by `chaos-sw`:

- Public `ChaosConfig` and `MiddlewareConfig` type exports.
- Direct browser-safe `path-to-regexp` routing with `@koa/router` removed.
- Backward-compatible path-only routes that match every origin.
- Absolute URL route patterns that match an exact normalized origin, including protocol and non-default port.
- Existing `createClient(config, baseFetch?)` API retained for both browser and Node usage.
- Verified latency, failure, mock, rate limiting, throttling, state reset, multi-tab behavior, and non-recursive worker pass-through.

`chaos-sw` must depend on `@fetchkit/chaos-fetch` version `^1.3.0` and use only its documented public API:

```ts
import {
  createClient,
  type ChaosConfig,
  type MiddlewareConfig,
} from '@fetchkit/chaos-fetch'

const chaosFetch = createClient(config, request => fetch(request))
```

Immediate repository cleanup before the runtime MVP:

- Upgrade the spike from `@fetchkit/chaos-fetch@1.2.3` to `^1.3.0`.
- Delete the temporary `http` and `url` shims.
- Remove the test that expects an unshimmed browser build to fail and replace it with a successful browser-bundle regression test.
- Rerun the complete Chromium, Node ESM, and multi-tab spike suite against the published package.

No additional `chaos-fetch` changes are required for the `chaos-sw` v1 implementation.
# 2. The chaos-sw npm package

## 2.1 Public entry points

Provide explicit page-side and worker-side APIs:

```ts
import {
  setupChaosWorker,
  type ChaosWorkerController,
} from '@fetchkit/chaos-sw'

import {
  createChaosWorkerRuntime,
} from '@fetchkit/chaos-sw/worker'
```

Suggested page-side API:

```ts
const chaos = setupChaosWorker({
  workerUrl: '/chaos-sw.js',
  scope: '/',
})

await chaos.start()
await chaos.enable()
await chaos.disable()
await chaos.getState()
await chaos.applyConfig(config)
await chaos.resetScenario()
```

`start()` registers or reconnects to the worker. After a fresh worker start, the runtime is disabled with an empty config until a controller reapplies state.

Suggested worker-side API:

```ts
const chaos = createChaosWorkerRuntime(options)

self.addEventListener('install', chaos.onInstall)
self.addEventListener('activate', chaos.onActivate)
self.addEventListener('message', chaos.onMessage)
self.addEventListener('fetch', chaos.onFetch)
```

Also ship a ready-built standalone worker for applications without an existing Service Worker.

## 2.2 Versioned control protocol

Define cross-context communication as serializable TypeScript unions.

Commands:

- `state:get`
- `config:apply`
- `chaos:enable`
- `chaos:disable`
- `scenario:reset`
- `ping`

Responses contain:

- correlation ID
- success/failure
- current state version
- validation result
- active origin and scope

Broadcasts contain:

- state changed
- ruleset applied
- validation failed
- worker activated/restarted

Use `MessageChannel` for commands and responses. Use controlled-client broadcasts or `BroadcastChannel` for state changes, with a fallback if needed.

## 2.3 Runtime configuration

The runtime accepts the exported `ChaosConfig` shape from `chaos-fetch`. YAML is an extension input format, not a core package concern.

The package validates protocol messages and handles handler-construction failures safely. YAML parsing, schema validation, filenames, dirty drafts, and invalid-document behavior live under `src/extension`.

Mandatory safety bypasses remain runtime-owned. Optional user-defined bypass behavior can be designed separately if needed.

## 2.4 In-memory state

The worker owns only:

- the currently applied `ChaosConfig`
- the enabled flag
- stateful middleware/scenario state
- a monotonically increasing in-memory version

Applying a config atomically replaces the active `chaos-fetch` handler and resets stateful middleware. If handler construction fails, the runtime installs an empty handler and returns an error.

The npm package does not persist YAML, filenames, configs, enabled state, or middleware counters. A Service Worker restart returns to disabled with an empty config until the extension or another page-side controller reapplies state.

## 2.5 Fetch interception

```text
fetch event
  -> await initialization
  -> disabled? normal fetch handling
  -> mandatory bypass? normal fetch handling
  -> configured bypass? normal fetch handling
  -> chaos-fetch handler(request, explicit worker fetch)
  -> emit bounded metadata
  -> return response
```

Mandatory bypasses include:

- Service Worker script and imports
- internal control endpoints, if any
- configured telemetry endpoints
- browser requests that cannot or should not be intercepted

Pass an explicit worker fetch to `createClient` to make the pass-through boundary clear. Document that browser CORS rules still apply to cross-origin requests.

## 2.7 Existing Service Worker coexistence

Only one Service Worker registration controls a document. Support:

- **Standalone mode:** `chaos-sw` owns the registration and fetch listener.
- **Integrated mode:** an existing worker imports and delegates to the chaos runtime.

The integrated API must make ordering explicit, with examples for chaos before and after cache handling. Do not silently replace an existing unrelated root-scoped worker; report a setup error unless replacement is explicitly requested.

Document PWA/Workbox/MSW coexistence as integration scenarios rather than attempting overlapping workers.

## 2.8 Build and distribution

- Publish ESM and declarations.
- Export page and worker entry points in `package.json`.
- Bundle a standalone worker asset that applications copy to their public root.
- Provide `npx chaos-sw init public` or equivalent to copy the worker asset.
- Add a package/worker protocol handshake and warn on version mismatch.
- Keep YAML/editor dependencies out of the smallest runtime entry when practical.
- Document the supported browser baseline.

## 2.9 Runtime testing

Unit tests:

- YAML parsing and validation
- bypass matching
- protocol serialization
- persistence and schema migration
- optimistic concurrency
- invalid-config empty fallback
- atomic handler replacement

Integration tests:

- valid global and route rules
- enabling/disabling across clients
- config broadcasts
- worker restart returns to disabled with an empty config
- stateful reset semantics
- cross-origin behavior
- streaming and throttling
- supported custom middleware behavior

Playwright browser tests:

- two tabs under one origin share enabled state and ruleset
- a newly opened tab uses the active ruleset
- disabled requests are unaffected
- worker restart can receive and apply config again
- worker restart restores persisted YAML
- existing-worker integration works

Run shared fixtures directly through `chaos-fetch` and through `chaos-sw` to prove compatibility.

# 3. DevTools extension

## 3.1 Scope and prerequisite

The extension is a controller for a same-origin `chaos-sw` installation. An extension Service Worker cannot itself intercept arbitrary website requests. The inspected application must serve/register the standalone worker or integrate the runtime into its existing worker.

Detect and report:

- no `chaos-sw` installation
- worker installed but the page is not controlled yet
- active enabled/disabled state
- worker origin and scope

## 3.2 Manifest V3 architecture

```text
DevTools panel
  <-> extension background worker
  <-> content script / inspected-page bridge
  <-> navigator.serviceWorker.controller
  <-> chaos-sw runtime
```

Use `chrome.devtools.inspectedWindow.tabId` to associate the panel with its inspected tab. Keep privileged APIs in the extension background worker. Validate every message received from an inspected page.

Although a panel belongs to one tab, state is origin-wide. Display prominently:

> Applies to all controlled tabs on `<origin><scope>`.

## 3.3 Panel v1

Include:

- connection/status banner
- origin and worker scope
- prominent enable/disable toggle
- ruleset filename
- YAML text editor
- Load button
- Apply & Save button
- unsaved-changes marker
- validation error with line/column when available
- reset-scenario action

Start with a lightweight editor. Add Monaco or CodeMirror only if diagnostics justify the bundle cost.

Button behavior:

- **Load** selects a local YAML file and replaces only the editor draft.
- **Apply & Save** is active when the draft differs from saved YAML or the saved version has not been applied.
- A valid save updates the saved baseline and active handler.
- An invalid save also updates the saved baseline, preserves the invalid text, shows the error, and indicates that an empty ruleset is active.
- Enable/disable does not rewrite or delete the ruleset.

Warn before replacing a dirty draft with a file or remotely changed content.

## 3.4 Multiple panels

Several panels may connect to tabs controlled by the same worker:

- Each panel loads YAML and version.
- Each tracks its own draft.
- The worker broadcasts successful saves.
- Clean panels update automatically.
- Dirty panels show â€œruleset changed elsewhere.â€
- Applying a stale version returns a conflict.

V1 conflict resolution can be reload-or-cancel; no merge editor is needed.

## 3.5 Extension persistence

The extension is authoritative for persisted ruleset state. Store the raw YAML, display filename, enabled preference, saved version, timestamp, and latest validation result in `chrome.storage.local`.

When a panel connects or detects a website-worker restart, it parses the saved YAML and reapplies the resulting config and enabled state. Invalid YAML remains saved for correction while the extension applies an empty config. The npm package and website worker have no persistence layer.

## 3.6 Extension packaging

- Keep all extension sources under `src/extension/`.
- Produce an unpacked development build and zipped release artifact.
- Publish the extension separately from the npm package/store artifact unless source distribution is deliberately desired.
- Add build, lint, test, browser-test, and zip scripts.
- Request least-privilege extension permissions and document each.
- Test extension background-worker suspension and reconnection.

# Delivery phases

## Phase 0: compatibility spike â€” completed

The initial spike against `@fetchkit/chaos-fetch@1.2.3` proved the Fetch-native runtime behavior in Chromium, including multi-tab state, routing, failures, latency, mocking, rate limiting, throttling, state reset, and non-recursive pass-through. It also identified the Node-dependent `@koa/router` browser-bundle blocker.

Exit result: a two-tab Playwright test demonstrated one worker and one ruleset affecting both tabs.

## Phase 1: chaos-fetch release â€” completed

Published as `@fetchkit/chaos-fetch@1.3.0`:

- Exported `ChaosConfig` and `MiddlewareConfig`.
- Replaced `@koa/router` with browser-safe direct `path-to-regexp` matching.
- Added exact-origin absolute URL routes while preserving origin-independent path routes.
- Preserved Node support and existing `createClient` behavior.

Exit result: `chaos-sw` can now depend only on documented public exports and bundle the runtime without Node shims.
## Phase 2: chaos-sw runtime MVP

- Upgrade to @fetchkit/chaos-fetch@^1.3.0, remove the spike-only shims, and rerun the compatibility suite.
- Scaffold package and public entry points.
- Implement the protocol and in-memory worker controller.
- Implement standalone worker and initialization CLI.
- Add enable/disable, config application, scenario reset, and invalid-config fallback.
- Add unit, integration, and multi-tab tests.
- Document standalone and existing-worker installation.

Exit criterion: an application can install the worker, apply a `ChaosConfig`, and affect all controlled tabs for the worker lifetime.

## Phase 3: in-page diagnostic UI

Build a minimal internal UI using the same controller protocol. Use it to stabilize file loading, dirty state, apply/save, and validation before introducing extension messaging layers.

Exit criterion: the complete editing workflow works without DevTools-extension infrastructure.

## Phase 4: DevTools extension MVP

- Scaffold the Manifest V3 extension.
- Implement panel/background/content/page messaging.
- Add installation and protocol detection.
- Add editor, file load, dirty state, Apply & Save, toggle, and validation errors.
- Implement YAML validation and authoritative persistence in `chrome.storage.local`.
- Reapply saved config and enabled state after website-worker restarts.
- Add multi-panel synchronization and version conflicts.
- Add automated extension integration tests where supported.

Exit criterion: a panel on any controlled tab manages the origin-wide ruleset.

## Phase 5: hardening and release

- Review message origins, payload validation, YAML handling, and displayed request data.
- Document CSP and Trusted Types requirements.
- Test browser restart, worker upgrades, version mismatch, offline behavior, and corrupt storage.
- Add storage migrations.
- Validate accessibility and keyboard workflows.
- Publish the npm package, initializer, documentation, examples, and extension artifact/listing.

# Definition of done for v1

- No copied middleware implementation and no shared `chaos-proxy` core.
- `chaos-sw` uses only public `chaos-fetch` APIs.
- Compatible YAML can be loaded, edited, applied, and persisted.
- Invalid YAML is saved for correction, visibly reported, and activates an empty ruleset.
- Enable/disable and ruleset changes affect every controlled tab under the displayed origin and scope.
- The extension restores YAML and reapplies the configured enable policy after a worker restart.
- Stateful reset semantics are documented.
- Existing-worker conflicts are detected and integration is documented.
- Panels communicate the origin-wide effect and synchronize saved state.
- Browser tests cover multiple tabs, persistence, valid/invalid application, and route rules.

# Deferred beyond v1

- Per-tab or per-client rulesets.
- Durable `failNth`, `failFirstN`, random, or rate-limit state.
- Request/response body capture or editing.
- Visual rule builder.
- Ruleset merge UI.
- Remote/shared ruleset synchronization.
- Firefox packaging if Chrome is the initial target.
- Transparent interception of sites that have not installed `chaos-sw`.





