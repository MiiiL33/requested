import type { Clock } from '@requested/core'

/**
 * Real time lives here, at the edge, rather than in `@requested/core` — which
 * is why the domain's age calculations are deterministic under test.
 */
export const systemClock: Clock = { now: () => new Date() }
