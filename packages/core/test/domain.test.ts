import { describe, expect, it } from 'vitest'
import { normalizeUsername, usernameFromProfileUrl } from '../src/domain/username.js'
import { buildProfileLinks } from '../src/domain/deep-link.js'

describe('normalizeUsername', () => {
  it.each([
    ['  Ada  ', 'ada'],
    ['@ada', 'ada'],
    ['ada/', 'ada'],
    ['@Ada_H/', 'ada_h'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeUsername(input)).toBe(expected)
  })
})

describe('usernameFromProfileUrl', () => {
  it.each([
    ['https://www.instagram.com/ada/', 'ada'],
    ['https://instagram.com/Ada', 'ada'],
    ['https://www.instagram.com/ada?hl=en', 'ada'],
    ['https://www.instagram.com/ada%5F1', 'ada_1'],
  ])('extracts the username from %j', (href, expected) => {
    expect(usernameFromProfileUrl(href)).toBe(expected)
  })

  it.each(['', 'https://example.com/ada', 'https://www.instagram.com/'])(
    'returns undefined for %j',
    (href) => {
      expect(usernameFromProfileUrl(href)).toBeUndefined()
    },
  )
})

describe('buildProfileLinks', () => {
  it('builds an app scheme link and a universal-link fallback', () => {
    expect(buildProfileLinks('ada')).toEqual({
      app: 'instagram://user?username=ada',
      web: 'https://www.instagram.com/ada/',
    })
  })

  it('strips a leading @ and encodes the handle', () => {
    expect(buildProfileLinks('@ada b')).toEqual({
      app: 'instagram://user?username=ada%20b',
      web: 'https://www.instagram.com/ada%20b/',
    })
  })
})
