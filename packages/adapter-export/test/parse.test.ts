import { describe, expect, it } from 'vitest'
import {
  buildSnapshot,
  collectStringListData,
  parseFollowing,
  parsePendingRequests,
} from '../src/parse.js'
import { MalformedExportError } from '../src/errors.js'
import { SENT_2020, followingJson, pendingFollowRequestsJson } from './fixtures/synthetic-export.js'

describe('collectStringListData', () => {
  it('finds entries regardless of the wrapping key name', () => {
    const underOneKey = collectStringListData({
      relationships_follow_requests_sent: [{ string_list_data: [{ value: 'ada' }] }],
    })
    const underAnother = collectStringListData({
      some_future_instagram_rename: [{ string_list_data: [{ value: 'ada' }] }],
    })

    expect(underOneKey).toEqual(underAnother)
    expect(underOneKey).toEqual([{ value: 'ada' }])
  })

  it('finds entries in a bare top-level array', () => {
    expect(collectStringListData([{ string_list_data: [{ value: 'ada' }] }])).toEqual([
      { value: 'ada' },
    ])
  })

  it('finds deeply nested entries', () => {
    expect(
      collectStringListData({ a: { b: { c: [{ string_list_data: [{ value: 'ada' }] }] } } }),
    ).toEqual([{ value: 'ada' }])
  })

  it('skips a malformed record without discarding its siblings', () => {
    const result = collectStringListData({
      list: [{ string_list_data: [{ value: 'ada' }, { value: 42 }, { value: 'grace' }] }],
    })

    expect(result).toEqual([{ value: 'ada' }, { value: 'grace' }])
  })

  it.each([[null], [undefined], [42], ['text'], [{}], [{ string_list_data: 'not-an-array' }]])(
    'returns nothing for %j',
    (input) => {
      expect(collectStringListData(input)).toEqual([])
    },
  )

  it('stops descending before runaway nesting', () => {
    let nested: unknown = { string_list_data: [{ value: 'too-deep' }] }
    for (let depth = 0; depth < 40; depth += 1) nested = { nested }

    expect(collectStringListData(nested)).toEqual([])
  })
})

describe('parsePendingRequests', () => {
  it('reads username, profile URL and sent date', () => {
    const requests = parsePendingRequests(pendingFollowRequestsJson)

    expect(requests).toHaveLength(4)
    expect(requests[0]).toEqual({
      username: 'ada_lovelace',
      profileUrl: 'https://www.instagram.com/ada_lovelace',
      sentAt: new Date(SENT_2020 * 1000),
    })
  })

  it('falls back to the profile URL when value is missing', () => {
    const json = JSON.stringify([
      { string_list_data: [{ href: 'https://www.instagram.com/ada/' }] },
    ])

    expect(parsePendingRequests(json)[0]?.username).toBe('ada')
  })

  it('synthesises a profile URL when href is missing', () => {
    const json = JSON.stringify([{ string_list_data: [{ value: 'ada' }] }])

    expect(parsePendingRequests(json)[0]?.profileUrl).toBe('https://www.instagram.com/ada/')
  })

  it('drops records that identify no account at all', () => {
    const json = JSON.stringify([{ string_list_data: [{ timestamp: SENT_2020 }] }])

    expect(parsePendingRequests(json)).toEqual([])
  })

  describe('timestamps', () => {
    it('leaves sentAt undefined when absent', () => {
      const json = JSON.stringify([{ string_list_data: [{ value: 'ada' }] }])

      expect(parsePendingRequests(json)[0]?.sentAt).toBeUndefined()
    })

    it.each([[0], [-1]])('treats %d as unknown rather than 1970', (timestamp) => {
      const json = JSON.stringify([{ string_list_data: [{ value: 'ada', timestamp }] }])

      expect(parsePendingRequests(json)[0]?.sentAt).toBeUndefined()
    })

    it('accepts millisecond timestamps as well as seconds', () => {
      const json = JSON.stringify([
        { string_list_data: [{ value: 'ada', timestamp: SENT_2020 * 1000 }] },
      ])

      expect(parsePendingRequests(json)[0]?.sentAt).toEqual(new Date(SENT_2020 * 1000))
    })
  })

  it('reports the offending file when the JSON is unreadable', () => {
    expect(() => parsePendingRequests('{ not json', 'pending.json')).toThrow(MalformedExportError)
    expect(() => parsePendingRequests('{ not json', 'pending.json')).toThrow(/pending\.json/)
  })
})

describe('parseFollowing', () => {
  it('returns the usernames you already follow', () => {
    expect(parseFollowing(followingJson)).toEqual(['katherine_j', 'margaret_h'])
  })
})

describe('buildSnapshot', () => {
  it('combines both files', () => {
    const snapshot = buildSnapshot({ pendingJson: pendingFollowRequestsJson, followingJson })

    expect(snapshot.pendingRequests).toHaveLength(4)
    expect(snapshot.following).toEqual(['katherine_j', 'margaret_h'])
  })

  it('tolerates a missing following file by skipping reconciliation', () => {
    const snapshot = buildSnapshot({ pendingJson: pendingFollowRequestsJson })

    expect(snapshot.following).toEqual([])
  })
})
