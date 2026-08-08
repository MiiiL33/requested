/**
 * A follow request you sent that Instagram still lists as outstanding.
 *
 * `sentAt` is optional on purpose: Instagram's export normally carries a
 * timestamp, but the field has been absent in some export versions. Rather
 * than invent a date we cannot know, we carry the absence forward and let
 * callers decide (see {@link findUnansweredRequests}, which excludes
 * undated requests from age filters rather than guessing).
 */
export interface PendingRequest {
  readonly username: string
  readonly profileUrl: string
  readonly sentAt?: Date
}

/**
 * One point-in-time view of the parts of your account we care about.
 *
 * `following` is needed for reconciliation: a request present in an export
 * may have been accepted since that export was generated, in which case the
 * account shows up in your following list and must not be treated as pending.
 */
export interface AccountSnapshot {
  readonly pendingRequests: readonly PendingRequest[]
  readonly following: readonly string[]
}

/** A pending request that survived reconciliation and filtering. */
export interface UnansweredRequest extends PendingRequest {
  /** Whole days between `sentAt` and now; `undefined` when `sentAt` is unknown. */
  readonly ageInDays?: number
}
