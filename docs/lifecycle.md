# Lifecycle, State, and Scope

chaos-sw state belongs to the active Service Worker instance.

## Initial State

A fresh runtime starts with:

- chaos disabled
- an empty configuration
- middleware counters reset
- state version `0`

Calling `start()` registers and connects to the worker. It does not enable chaos or restore a configuration.

## Applying Configuration

`applyConfig(config)` constructs a new chaos-fetch handler before making it active. New requests use the new handler after the command succeeds.

Applying any configuration resets stateful middleware, including counters used by `failNth`, `failFirstN`, and `rateLimit`.

If handler construction fails:

1. The invalid handler is not activated.
2. An empty handler becomes active.
3. Middleware state is reset.
4. The command rejects with the construction error.

This empty fallback keeps interception predictable when a controller submits an invalid configuration.

## Enabling and Disabling

`enable()` activates interception using the current handler.

`disable()` stops chaos handling without deleting the current config. Because the runtime then does not call `respondWith()`, requests continue through the browser or another compatible fetch listener.

## Shared Across Tabs

A Service Worker registration has one active runtime shared by all controlled clients. Commands sent from one tab therefore affect every tab under the same origin and scope:

- enabling and disabling
- applying configuration
- resetting scenarios

The page-side state is not tab-local. User interfaces should clearly communicate the active origin and scope.

## Worker Restarts

Browsers may terminate an idle Service Worker and start it again later. Because the core package has no persistence, a restarted worker returns to its initial disabled and empty state.

A test harness, application controller, or DevTools extension that needs restoration must store state separately and reapply it after reconnecting.

Stateful middleware counters are never persisted.

## State Version

The runtime increments its in-memory `version` when configuration or enabled state changes and when a scenario is reset.

The value is useful for diagnostics. It is not durable, does not coordinate concurrent writers, and resets to zero with the worker.

## Request Lifetime

Requests already executing keep the handler instance with which they started. Replacing or resetting a handler affects subsequent requests; it does not cancel requests already in flight.

