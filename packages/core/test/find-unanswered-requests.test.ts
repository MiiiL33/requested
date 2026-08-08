import { describe, expect, it } from 'vitest'
import { findUnansweredRequests } from '../src/use-cases/find-unanswered-requests.js'
import { fixedClock } from '../src/ports.js'
import type { AccountSnapshot, PendingRequest } from '../src/domain/types.js'

const clock = fixedClock(new Date('2026-08-08T00:00:00.000Z'))

function request(username: string, sentAt?: string): PendingRequest {
  return {
    username,
    profileUrl: `https://www.instagram.com/${username}/`,
    ...(sentAt === undefined ? {} : { sentAt: new Date(sentAt) }),
  }
}

function snapshot(pendingRequests: PendingRequest[], following: string[] = []): AccountSnapshot {
  return { pendingRequests, following }
}

describe('findUnansweredRequests', () => {
  it('returns pending requests with their age in whole days', () => {
    const result = findUnansweredRequests(snapshot([request('ada', '2026-08-01T00:00:00.000Z')]), {
      clock,
    })

    expect(result).toEqual([expect.objectContaining({ username: 'ada', ageInDays: 7 })])
  })

  describe('reconciliation against the following list', () => {
    it('drops requests that were accepted after the snapshot was taken', () => {
      const result = findUnansweredRequests(
        snapshot([request('ada'), request('grace')], ['grace']),
        { clock },
      )

      expect(result.map((r) => r.username)).toEqual(['ada'])
    })

    it('matches case-insensitively, since export files disagree on casing', () => {
      const result = findUnansweredRequests(snapshot([request('Grace_H')], ['grace_h']), { clock })

      expect(result).toEqual([])
    })
  })

  it('collapses duplicate entries so nobody is queued twice', () => {
    const result = findUnansweredRequests(
      snapshot([request('ada', '2026-01-01T00:00:00.000Z'), request('ADA')]),
      { clock },
    )

    expect(result).toHaveLength(1)
  })

  it('ignores blank usernames', () => {
    expect(findUnansweredRequests(snapshot([request('  ')]), { clock })).toEqual([])
  })

  describe('olderThanDays', () => {
    it('keeps only requests at or beyond the threshold', () => {
      const result = findUnansweredRequests(
        snapshot([
          request('recent', '2026-08-06T00:00:00.000Z'), // 2 days
          request('stale', '2026-01-01T00:00:00.000Z'), // ~219 days
        ]),
        { clock, olderThanDays: 90 },
      )

      expect(result.map((r) => r.username)).toEqual(['stale'])
    })

    it('excludes undated requests rather than guessing they are old', () => {
      const result = findUnansweredRequests(snapshot([request('mystery')]), {
        clock,
        olderThanDays: 90,
      })

      expect(result).toEqual([])
    })

    it('includes undated requests when no age filter is applied', () => {
      const result = findUnansweredRequests(snapshot([request('mystery')]), { clock })

      expect(result).toHaveLength(1)
      expect(result[0]?.username).toBe('mystery')
      expect(result[0]?.ageInDays).toBeUndefined()
    })
  })

  describe('ordering', () => {
    it('sorts oldest first', () => {
      const result = findUnansweredRequests(
        snapshot([
          request('newer', '2026-07-01T00:00:00.000Z'),
          request('oldest', '2020-01-01T00:00:00.000Z'),
          request('middle', '2024-01-01T00:00:00.000Z'),
        ]),
        { clock },
      )

      expect(result.map((r) => r.username)).toEqual(['oldest', 'middle', 'newer'])
    })

    it('places undated requests last and breaks ties by username', () => {
      const result = findUnansweredRequests(
        snapshot([
          request('zoe', '2024-01-01T00:00:00.000Z'),
          request('unknown'),
          request('alan', '2024-01-01T00:00:00.000Z'),
        ]),
        { clock },
      )

      expect(result.map((r) => r.username)).toEqual(['alan', 'zoe', 'unknown'])
    })
  })

  it('clamps future timestamps to zero instead of reporting negative age', () => {
    const result = findUnansweredRequests(
      snapshot([request('timetraveller', '2027-01-01T00:00:00.000Z')]),
      { clock },
    )

    expect(result[0]?.ageInDays).toBe(0)
  })

  it('treats an unparseable date as unknown', () => {
    const result = findUnansweredRequests(
      snapshot([{ username: 'broken', profileUrl: '', sentAt: new Date('nonsense') }]),
      { clock },
    )

    expect(result[0]?.ageInDays).toBeUndefined()
  })

  it('handles an empty snapshot', () => {
    expect(findUnansweredRequests(snapshot([]), { clock })).toEqual([])
  })
})
