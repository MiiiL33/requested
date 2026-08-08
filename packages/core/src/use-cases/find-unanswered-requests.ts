import { normalizeUsername } from '../domain/username.js'
import type { AccountSnapshot, PendingRequest, UnansweredRequest } from '../domain/types.js'
import type { Clock } from '../ports.js'

const MS_PER_DAY = 86_400_000

export interface FindOptions {
  readonly clock: Clock
  /**
   * Keep only requests at least this many days old.
   *
   * Requests with no known `sentAt` are excluded when this is set: we cannot
   * prove they are old, and the conservative failure mode is to leave a request
   * alone rather than to cancel one the user might still want outstanding.
   */
  readonly olderThanDays?: number
}

/**
 * The product's central computation: given a snapshot of your account, which
 * follow requests are genuinely still unanswered and worth cancelling?
 *
 * Pure and synchronous — no I/O, no ambient time — so the CLI, the web app and
 * the mobile app all share this exact behaviour, and it is trivially testable.
 */
export function findUnansweredRequests(
  snapshot: AccountSnapshot,
  options: FindOptions,
): UnansweredRequest[] {
  const { clock, olderThanDays } = options
  const now = clock.now().getTime()

  const following = new Set(snapshot.following.map(normalizeUsername))

  // Exports have been observed to repeat entries across split files; collapse
  // them so a user is never asked to cancel the same account twice.
  const deduped = new Map<string, PendingRequest>()
  for (const request of snapshot.pendingRequests) {
    const key = normalizeUsername(request.username)
    if (key === '') continue
    // Reconciliation: accepted since the snapshot was taken, so not pending.
    if (following.has(key)) continue
    if (!deduped.has(key)) deduped.set(key, request)
  }

  const results: UnansweredRequest[] = []
  for (const request of deduped.values()) {
    const ageInDays = computeAgeInDays(request.sentAt, now)

    if (olderThanDays !== undefined) {
      if (ageInDays === undefined || ageInDays < olderThanDays) continue
    }

    results.push(ageInDays === undefined ? { ...request } : { ...request, ageInDays })
  }

  return results.sort(oldestFirst)
}

function computeAgeInDays(sentAt: Date | undefined, now: number): number | undefined {
  if (sentAt === undefined) return undefined
  const sent = sentAt.getTime()
  if (Number.isNaN(sent)) return undefined
  // Clamp: a future timestamp means clock skew, not a negative-age request.
  return Math.max(0, Math.floor((now - sent) / MS_PER_DAY))
}

/**
 * Oldest first — the requests most likely to be forgotten and safest to cancel.
 * Undated requests sort last, and username breaks ties so output is stable
 * across runs (which matters for resumable queues and for test assertions).
 */
function oldestFirst(a: UnansweredRequest, b: UnansweredRequest): number {
  const aTime = a.sentAt?.getTime()
  const bTime = b.sentAt?.getTime()

  if (aTime !== bTime) {
    if (aTime === undefined) return 1
    if (bTime === undefined) return -1
    return aTime - bTime
  }
  return normalizeUsername(a.username).localeCompare(normalizeUsername(b.username))
}
