import { describe, expect, it } from 'vitest'

import { isChaosWorkerResponse, type ChaosWorkerState } from '../../src/protocol.js'

const state: ChaosWorkerState = {
  enabled: false,
  version: 0,
  scope: 'http://localhost/',
}

describe('isChaosWorkerResponse', () => {
  it('accepts a success response', () => {
    expect(isChaosWorkerResponse({ id: 'a', ok: true, state })).toBe(true)
  })

  it('accepts an error response', () => {
    expect(isChaosWorkerResponse({ id: 'a', ok: false, error: 'boom', state })).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'response'],
    ['a number', 42],
    ['an array', []],
    ['an empty object', {}],
    ['a missing id', { ok: true, state }],
    ['a non-string id', { id: 1, ok: true, state }],
    ['a missing ok', { id: 'a', state }],
    ['a non-boolean ok', { id: 'a', ok: 'yes', state }],
  ])('rejects %s', (_label, value) => {
    expect(isChaosWorkerResponse(value)).toBe(false)
  })

  it('is a transport guard only and does not inspect the payload', () => {
    expect(isChaosWorkerResponse({ id: 'a', ok: true })).toBe(true)
    expect(isChaosWorkerResponse({ id: 'a', ok: false })).toBe(true)
  })
})
