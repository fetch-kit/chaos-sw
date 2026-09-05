import type { ChaosConfig } from '@fetchkit/chaos-fetch'

export interface ChaosWorkerState {
  enabled: boolean
  version: number
  scope: string
}

type Command<TType extends string, TPayload = Record<string, never>> = {
  id: string
  type: TType
} & TPayload

export type ChaosWorkerCommand =
  | Command<'ping'>
  | Command<'state:get'>
  | Command<'chaos:enable'>
  | Command<'chaos:disable'>
  | Command<'config:apply', { config: ChaosConfig }>
  | Command<'scenario:reset'>

export type ChaosWorkerCommandInput =
  | { type: 'ping' }
  | { type: 'state:get' }
  | { type: 'chaos:enable' }
  | { type: 'chaos:disable' }
  | { type: 'config:apply'; config: ChaosConfig }
  | { type: 'scenario:reset' }

export type ChaosWorkerResponse =
  | { id: string; ok: true; state: ChaosWorkerState }
  | { id: string; ok: false; error: string; state: ChaosWorkerState }

export function isChaosWorkerResponse(value: unknown): value is ChaosWorkerResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<ChaosWorkerResponse>
  return typeof response.id === 'string'
    && typeof response.ok === 'boolean'
}
