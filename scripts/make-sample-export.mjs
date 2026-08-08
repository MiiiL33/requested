#!/usr/bin/env node
/**
 * Writes a synthetic Instagram data export so you can try the CLI immediately.
 *
 * Instagram takes hours to deliver a real export, and a real one contains your
 * actual social graph — neither is something you want in the loop while
 * developing. Every account below is invented.
 *
 *   node scripts/make-sample-export.mjs sample-export.zip
 *   node packages/cli/dist/index.js list --export sample-export.zip
 */
import { writeFileSync } from 'node:fs'
import { strToU8, zipSync } from 'fflate'

const EXPORT_DIR = 'connections/followers_and_following'
const output = process.argv[2] ?? 'sample-export.zip'

const seconds = (iso) => Math.floor(new Date(iso).getTime() / 1000)

/**
 * Sent follow requests use a bare array of `label_values` entries, and leave
 * `URL` blank for almost every record — confirmed against a real August 2026
 * export, where 377 of 390 records had no URL.
 */
const pendingEntry = (username, iso, url = '') => ({
  ...(iso === undefined ? {} : { timestamp: seconds(iso) }),
  media: [],
  label_values: [
    { label: 'URL', value: url },
    { label: 'Name', value: `Display ${username}` },
    { label: 'Username', value: username },
  ],
  fbid: `fbid_${username}`,
})

/** Following/followers use the older `string_list_data` shape. */
const followingEntry = (username, iso) => ({
  title: '',
  media_list_data: [],
  string_list_data: [
    {
      href: `https://www.instagram.com/${username}`,
      value: username,
      ...(iso === undefined ? {} : { timestamp: seconds(iso) }),
    },
  ],
})

const pendingFollowRequests = [
  pendingEntry('ada_lovelace', '2019-03-14T10:00:00Z'),
  pendingEntry('grace_hopper', '2021-11-02T18:30:00Z'),
  pendingEntry('katherine_j', '2022-08-24T12:00:00Z'), // accepted since — also in following.json
  pendingEntry('alan_turing', '2023-06-23T09:15:00Z', 'https://www.instagram.com/alan_turing'),
  pendingEntry('margaret_h', '2026-07-20T08:00:00Z'), // recent
  pendingEntry('no_date_account'), // export without a timestamp
  pendingEntry('ADA_LOVELACE', '2019-03-14T10:00:00Z'), // duplicate in different casing
]

const following = {
  relationships_following: [
    followingEntry('katherine_j', '2022-09-01T12:00:00Z'),
    followingEntry('barbara_l'),
  ],
}

writeFileSync(
  output,
  zipSync({
    [`${EXPORT_DIR}/pending_follow_requests.json`]: strToU8(
      JSON.stringify(pendingFollowRequests, null, 2),
    ),
    [`${EXPORT_DIR}/following.json`]: strToU8(JSON.stringify(following, null, 2)),
    // Stand-in for the media a real export is mostly made of — the parser must
    // never decompress this.
    'media/posts/photo_1.jpg': strToU8('x'.repeat(500_000)),
  }),
)

console.log(`Wrote ${output}`)
