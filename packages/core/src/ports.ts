import type { AccountSnapshot, PendingRequest } from './domain/types.js'

/**
 * Where account data comes from. Implemented by `@requested/export` (an
 * Instagram data-export archive) and, in the CLI only, by a live-session
 * reader. The domain never learns which one it got.
 */
export interface RequestSource {
  load(): Promise<AccountSnapshot>
}

export type CancellationStatus = 'cancelled' | 'skipped' | 'failed'

export interface CancellationOutcome {
  readonly username: string
  readonly status: CancellationStatus
  readonly error?: string
}

/**
 * How a single request gets cancelled.
 *
 * Store-publishable builds implement this by handing the user a deep link and
 * recording what they report back — the user performs the action, which is what
 * keeps those builds compliant. The automation adapter implements it by driving
 * a browser, and is deliberately excluded from every app build.
 */
export interface RequestCanceller {
  cancel(request: PendingRequest): Promise<CancellationOutcome>
}

/**
 * Ambient time, injected. Domain code must never call `Date.now()` directly —
 * age calculations would then be untestable. Enforced by lint rule in
 * `eslint.config.js`.
 */
export interface Clock {
  now(): Date
}

export const fixedClock = (at: Date): Clock => ({ now: () => at })
