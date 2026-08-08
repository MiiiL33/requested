import { describe, expect, it } from 'vitest'
import type { UnansweredRequest } from '@requested/core'
import { renderCsv, renderJson, renderTable, summarize } from '../src/render.js'

const plain = (value: string): string =>
  // eslint-disable-next-line no-control-regex
  value.replace(/\[\d+m/g, '')

const requests: UnansweredRequest[] = [
  {
    username: 'ada_lovelace',
    profileUrl: 'https://www.instagram.com/ada_lovelace',
    sentAt: new Date('2020-09-13T12:26:40.000Z'),
    ageInDays: 2155,
  },
  {
    username: 'grace_hopper',
    profileUrl: 'https://www.instagram.com/grace_hopper',
  },
]

describe('renderTable', () => {
  it('lists each account with its sent date and age', () => {
    const output = plain(renderTable(requests))

    expect(output).toContain('ACCOUNT')
    expect(output).toContain('ada_lovelace')
    expect(output).toContain('2020-09-13')
    expect(output).toContain('5y')
  })

  it('marks an unknown date rather than inventing one', () => {
    const output = plain(renderTable(requests))

    expect(output).toContain('—')
    expect(output).toContain('unknown')
  })
})

describe('renderJson', () => {
  it('emits null for unknown values so the shape stays stable', () => {
    const parsed: unknown = JSON.parse(renderJson(requests))

    expect(parsed).toEqual([
      {
        username: 'ada_lovelace',
        profileUrl: 'https://www.instagram.com/ada_lovelace',
        sentAt: '2020-09-13T12:26:40.000Z',
        ageInDays: 2155,
      },
      {
        username: 'grace_hopper',
        profileUrl: 'https://www.instagram.com/grace_hopper',
        sentAt: null,
        ageInDays: null,
      },
    ])
  })
})

describe('renderCsv', () => {
  it('writes a header and one row per request', () => {
    const lines = renderCsv(requests).split('\n')

    expect(lines[0]).toBe('username,profile_url,sent_at,age_in_days')
    expect(lines[1]).toBe(
      'ada_lovelace,https://www.instagram.com/ada_lovelace,2020-09-13T12:26:40.000Z,2155',
    )
    expect(lines[2]).toBe('grace_hopper,https://www.instagram.com/grace_hopper,,')
  })

  it('quotes fields containing separators', () => {
    const output = renderCsv([{ username: 'a,b"c', profileUrl: '' }])

    expect(output).toContain('"a,b""c"')
  })
})

describe('summarize', () => {
  it('reports the count and the oldest age', () => {
    expect(plain(summarize(requests))).toBe('2 unanswered follow requests · oldest 5y')
  })

  it('uses the singular for one request', () => {
    expect(plain(summarize([requests[0]!]))).toContain('1 unanswered follow request ')
  })

  it('celebrates an empty backlog', () => {
    expect(plain(summarize([]))).toContain('Nothing to clear')
  })
})
