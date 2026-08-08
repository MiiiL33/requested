import { normalizeUsername } from '../domain/username.js'
import type { UnansweredRequest } from '../domain/types.js'

export type QueueEntryStatus = 'pending' | 'cancelled' | 'skipped'

export interface QueueEntry {
  readonly username: string
  readonly status: QueueEntryStatus
}

/** Serializable queue state — persist this to resume across restarts. */
export interface QueueState {
  readonly version: 1
  readonly entries: readonly QueueEntry[]
}

export interface QueueProgress {
  readonly total: number
  readonly cancelled: number
  readonly skipped: number
  readonly remaining: number
}

/**
 * Instagram offers no bulk cancel, so clearing 200 requests means 200 manual
 * visits. This turns that into a resumable checklist — which is the actual
 * product, and why it lives in `core` where the CLI, web and mobile clients
 * all inherit it rather than reimplementing it three times.
 *
 * Immutable: every transition returns a new queue, so UI layers can treat
 * state changes as plain value updates.
 */
export class CancellationQueue {
  private constructor(
    private readonly requests: ReadonlyMap<string, UnansweredRequest>,
    private readonly entries: readonly QueueEntry[],
  ) {}

  static start(requests: readonly UnansweredRequest[]): CancellationQueue {
    return CancellationQueue.build(requests, new Map())
  }

  /**
   * Rebuild a queue from persisted state against a freshly loaded request list.
   *
   * The new list is authoritative for *membership* and order; prior state is
   * authoritative for *progress*. So re-importing a newer export naturally
   * converges: requests that are gone (cancelled, or accepted in the meantime)
   * drop out, and newly appeared ones join as pending.
   */
  static restore(state: QueueState, requests: readonly UnansweredRequest[]): CancellationQueue {
    const previous = new Map<string, QueueEntryStatus>()
    for (const entry of state.entries) {
      previous.set(normalizeUsername(entry.username), entry.status)
    }
    return CancellationQueue.build(requests, previous)
  }

  private static build(
    requests: readonly UnansweredRequest[],
    previous: ReadonlyMap<string, QueueEntryStatus>,
  ): CancellationQueue {
    const byUsername = new Map<string, UnansweredRequest>()
    const entries: QueueEntry[] = []

    for (const request of requests) {
      const key = normalizeUsername(request.username)
      if (byUsername.has(key)) continue
      byUsername.set(key, request)
      entries.push({ username: key, status: previous.get(key) ?? 'pending' })
    }

    return new CancellationQueue(byUsername, entries)
  }

  /** The request the user should act on next, or `undefined` when finished. */
  get current(): UnansweredRequest | undefined {
    const entry = this.entries.find((candidate) => candidate.status === 'pending')
    return entry === undefined ? undefined : this.requests.get(entry.username)
  }

  get isComplete(): boolean {
    return this.current === undefined
  }

  get progress(): QueueProgress {
    let cancelled = 0
    let skipped = 0
    for (const entry of this.entries) {
      if (entry.status === 'cancelled') cancelled += 1
      else if (entry.status === 'skipped') skipped += 1
    }
    return {
      total: this.entries.length,
      cancelled,
      skipped,
      remaining: this.entries.length - cancelled - skipped,
    }
  }

  /** All requests in queue order, paired with their current status. */
  get items(): readonly { request: UnansweredRequest; status: QueueEntryStatus }[] {
    return this.entries.flatMap((entry) => {
      const request = this.requests.get(entry.username)
      return request === undefined ? [] : [{ request, status: entry.status }]
    })
  }

  markCancelled(): CancellationQueue {
    return this.advance('cancelled')
  }

  markSkipped(): CancellationQueue {
    return this.advance('skipped')
  }

  private advance(status: QueueEntryStatus): CancellationQueue {
    const index = this.entries.findIndex((entry) => entry.status === 'pending')
    if (index === -1) return this

    const next = this.entries.map((entry, at) => (at === index ? { ...entry, status } : entry))
    return new CancellationQueue(this.requests, next)
  }

  toState(): QueueState {
    return { version: 1, entries: this.entries }
  }
}
