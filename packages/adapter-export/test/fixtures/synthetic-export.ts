/**
 * A synthetic Instagram export.
 *
 * Deliberately invented accounts: real exports contain your social graph, and
 * that must never end up in a public repository or in CI logs.
 */

/** 2020-09-13T12:26:40Z */
export const SENT_2020 = 1_600_000_000
/** 2023-11-14T22:13:20Z */
export const SENT_2023 = 1_700_000_000
/** 2025-06-15T14:53:20Z */
export const SENT_2025 = 1_750_000_000

function entry(username: string, timestamp?: number) {
  return {
    title: '',
    media_list_data: [],
    string_list_data: [
      {
        href: `https://www.instagram.com/${username}`,
        value: username,
        ...(timestamp === undefined ? {} : { timestamp }),
      },
    ],
  }
}

export const pendingFollowRequestsJson = JSON.stringify({
  relationships_follow_requests_sent: [
    entry('ada_lovelace', SENT_2020),
    entry('grace_hopper', SENT_2023),
    entry('alan_turing', SENT_2025),
    // Accepted since this export was generated — appears in following.json too.
    entry('katherine_j', SENT_2023),
  ],
})

export const followingJson = JSON.stringify({
  relationships_following: [entry('katherine_j', SENT_2023), entry('margaret_h', SENT_2020)],
})

export const pendingFollowRequestsHtml =
  '<!DOCTYPE html><html><body><h1>Pending follow requests</h1></body></html>'
