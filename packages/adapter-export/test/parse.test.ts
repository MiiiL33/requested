import { describe, expect, it } from 'vitest'
import {
  buildSnapshot,
  collectRelationships,
  parseFollowing,
  parsePendingRequests,
} from '../src/parse.js'
import { MalformedExportError } from '../src/errors.js'
import { SENT_2020, followingJson, pendingFollowRequestsJson } from './fixtures/synthetic-export.js'

describe('collectRelationships', () => {
  describe('string_list_data format (following.json, followers_*.json)', () => {
    it('finds entries regardless of the wrapping key name', () => {
      const underOneKey = collectRelationships({
        relationships_following: [{ string_list_data: [{ value: 'ada' }] }],
      })
      const underAnother = collectRelationships({
        some_future_instagram_rename: [{ string_list_data: [{ value: 'ada' }] }],
      })

      expect(underOneKey).toEqual(underAnother)
      expect(underOneKey).toEqual([{ username: 'ada' }])
    })

    it('finds entries in a bare top-level array', () => {
      expect(collectRelationships([{ string_list_data: [{ value: 'ada' }] }])).toEqual([
        { username: 'ada' },
      ])
    })

    it('finds deeply nested entries', () => {
      expect(
        collectRelationships({ a: { b: { c: [{ string_list_data: [{ value: 'ada' }] }] } } }),
      ).toEqual([{ username: 'ada' }])
    })

    it('skips a malformed record without discarding its siblings', () => {
      const result = collectRelationships({
        list: [{ string_list_data: [{ value: 'ada' }, { value: 42 }, { value: 'grace' }] }],
      })

      expect(result).toEqual([{ username: 'ada' }, { username: 'grace' }])
    })

    it('carries href and timestamp through', () => {
      const result = collectRelationships([
        { string_list_data: [{ value: 'ada', href: 'https://x/ada', timestamp: SENT_2020 }] },
      ])

      expect(result).toEqual([{ username: 'ada', href: 'https://x/ada', timestamp: SENT_2020 }])
    })
  })

  describe('label_values format (pending_follow_requests.json)', () => {
    it('reads the username from the labelled entry', () => {
      const result = collectRelationships([
        {
          timestamp: SENT_2020,
          media: [],
          label_values: [
            { label: 'URL', value: '' },
            { label: 'Name', value: 'Ada L' },
            { label: 'Username', value: 'ada' },
          ],
          fbid: 'x',
        },
      ])

      expect(result).toEqual([{ username: 'ada', timestamp: SENT_2020 }])
    })

    it('treats a blank URL as absent rather than as a profile link', () => {
      const result = collectRelationships([
        {
          label_values: [
            { label: 'URL', value: '   ' },
            { label: 'Username', value: 'ada' },
          ],
        },
      ])

      expect(result).toEqual([{ username: 'ada' }])
    })

    it('keeps a populated URL', () => {
      const result = collectRelationships([
        {
          label_values: [
            { label: 'URL', value: 'https://www.instagram.com/ada' },
            { label: 'Username', value: 'ada' },
          ],
        },
      ])

      expect(result).toEqual([{ username: 'ada', href: 'https://www.instagram.com/ada' }])
    })

    it('never mistakes the display name for the handle', () => {
      const result = collectRelationships([
        {
          label_values: [
            { label: 'Name', value: 'Ada Lovelace' },
            { label: 'Username', value: 'ada' },
          ],
        },
      ])

      expect(result).toEqual([{ username: 'ada' }])
    })

    it.each([
      ['Username', 'ada'],
      ["Nom d'utilisateur", 'ada'],
      ['Nombre de usuario', 'ada'],
      ['User Name', 'ada'],
    ])('recognises the %j label across locales', (label, expected) => {
      expect(collectRelationships([{ label_values: [{ label, value: expected }] }])).toEqual([
        { username: expected },
      ])
    })

    it('falls back to a value that looks like a URL when no label matches', () => {
      const result = collectRelationships([
        { label_values: [{ label: 'Profil', value: 'https://www.instagram.com/ada' }] },
      ])

      expect(result).toEqual([{ href: 'https://www.instagram.com/ada' }])
    })

    it('drops an entry that identifies nobody', () => {
      expect(collectRelationships([{ label_values: [{ label: 'Name', value: 'Ada' }] }])).toEqual(
        [],
      )
    })
  })

  it.each([[null], [undefined], [42], ['text'], [{}], [{ string_list_data: 'not-an-array' }]])(
    'returns nothing for %j',
    (input) => {
      expect(collectRelationships(input)).toEqual([])
    },
  )

  it('stops descending before runaway nesting', () => {
    let nested: unknown = { string_list_data: [{ value: 'too-deep' }] }
    for (let depth = 0; depth < 40; depth += 1) nested = { nested }

    expect(collectRelationships(nested)).toEqual([])
  })
})

describe('parsePendingRequests', () => {
  it('reads username, profile URL and sent date from the real format', () => {
    const requests = parsePendingRequests(pendingFollowRequestsJson)

    expect(requests).toHaveLength(4)
    expect(requests[0]).toEqual({
      username: 'ada_lovelace',
      profileUrl: 'https://www.instagram.com/ada_lovelace/',
      sentAt: new Date(SENT_2020 * 1000),
    })
  })

  it('synthesises a profile URL when the export leaves it blank', () => {
    const json = JSON.stringify([{ label_values: [{ label: 'Username', value: 'ada' }] }])

    expect(parsePendingRequests(json)[0]?.profileUrl).toBe('https://www.instagram.com/ada/')
  })

  it('prefers the exported URL when one is present', () => {
    const requests = parsePendingRequests(pendingFollowRequestsJson)

    expect(requests[2]).toMatchObject({
      username: 'alan_turing',
      profileUrl: 'https://www.instagram.com/alan_turing',
    })
  })

  it('falls back to the profile URL when only a link is present', () => {
    const json = JSON.stringify([
      { string_list_data: [{ href: 'https://www.instagram.com/ada/' }] },
    ])

    expect(parsePendingRequests(json)[0]?.username).toBe('ada')
  })

  it('drops records that identify no account at all', () => {
    const json = JSON.stringify([{ string_list_data: [{ timestamp: SENT_2020 }] }])

    expect(parsePendingRequests(json)).toEqual([])
  })

  describe('timestamps', () => {
    it('leaves sentAt undefined when absent', () => {
      const json = JSON.stringify([{ label_values: [{ label: 'Username', value: 'ada' }] }])

      expect(parsePendingRequests(json)[0]?.sentAt).toBeUndefined()
    })

    it.each([[0], [-1]])('treats %d as unknown rather than 1970', (timestamp) => {
      const json = JSON.stringify([
        { timestamp, label_values: [{ label: 'Username', value: 'ada' }] },
      ])

      expect(parsePendingRequests(json)[0]?.sentAt).toBeUndefined()
    })

    it('accepts millisecond timestamps as well as seconds', () => {
      const json = JSON.stringify([
        { timestamp: SENT_2020 * 1000, label_values: [{ label: 'Username', value: 'ada' }] },
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
  it('combines both files, each in its own format', () => {
    const snapshot = buildSnapshot({ pendingJson: pendingFollowRequestsJson, followingJson })

    expect(snapshot.pendingRequests).toHaveLength(4)
    expect(snapshot.following).toEqual(['katherine_j', 'margaret_h'])
  })

  it('tolerates a missing following file by skipping reconciliation', () => {
    const snapshot = buildSnapshot({ pendingJson: pendingFollowRequestsJson })

    expect(snapshot.following).toEqual([])
  })
})
