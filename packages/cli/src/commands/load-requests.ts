import { findUnansweredRequests } from '@requested/core'
import type { UnansweredRequest } from '@requested/core'
import { InstagramExportSource } from '@requested/export'
import { parseDurationInDays } from '../duration.js'
import { systemClock } from '../clock.js'

export interface LoadOptions {
  readonly export: string
  readonly olderThan?: string
}

/** Shared by every command — one place that knows how CLI flags become a query. */
export async function loadRequests(options: LoadOptions): Promise<UnansweredRequest[]> {
  const snapshot = await new InstagramExportSource(options.export).load()

  return findUnansweredRequests(snapshot, {
    clock: systemClock,
    ...(options.olderThan === undefined
      ? {}
      : { olderThanDays: parseDurationInDays(options.olderThan) }),
  })
}
