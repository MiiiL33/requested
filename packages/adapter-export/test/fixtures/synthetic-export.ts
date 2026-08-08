/**
 * A synthetic Instagram export, mirroring the shapes seen in a real
 * August 2026 archive.
 *
 * Deliberately invented accounts: real exports contain your social graph, and
 * that must never end up in a public repository or in CI logs.
 *
 * Note the two files use *different* formats — that is not a mistake, it is
 * what Instagram actually ships:
 *   - pending_follow_requests.json → bare array of `label_values` entries
 *   - following.json               → `relationships_following` + `string_list_data`
 */

/** 2020-09-13T12:26:40Z */
export const SENT_2020 = 1_600_000_000
/** 2023-11-14T22:13:20Z */
export const SENT_2023 = 1_700_000_000
/** 2025-06-15T14:53:20Z */
export const SENT_2025 = 1_750_000_000

/** Format B — how sent follow requests are actually stored. */
function labelledEntry(username: string, timestamp?: number, url = '') {
  return {
    ...(timestamp === undefined ? {} : { timestamp }),
    media: [],
    label_values: [
      // Real exports leave URL blank for the vast majority of records.
      { label: 'URL', value: url },
      { label: 'Name', value: `Display ${username}` },
      { label: 'Username', value: username },
    ],
    fbid: `fbid_${username}`,
  }
}

/** Format A — how following/followers are stored. */
function stringListEntry(username: string, timestamp?: number) {
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

export const pendingFollowRequestsJson = JSON.stringify([
  labelledEntry('ada_lovelace', SENT_2020),
  labelledEntry('grace_hopper', SENT_2023),
  labelledEntry('alan_turing', SENT_2025, 'https://www.instagram.com/alan_turing'),
  // Accepted since this export was generated — appears in following.json too.
  labelledEntry('katherine_j', SENT_2023),
])

export const followingJson = JSON.stringify({
  relationships_following: [
    stringListEntry('katherine_j', SENT_2023),
    stringListEntry('margaret_h', SENT_2020),
  ],
})

export const pendingFollowRequestsHtml =
  '<!DOCTYPE html><html><body><h1>Pending follow requests</h1></body></html>'
