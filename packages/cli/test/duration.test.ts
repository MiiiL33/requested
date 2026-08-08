import { describe, expect, it } from 'vitest'
import { InvalidDurationError, formatAge, parseDurationInDays } from '../src/duration.js'

describe('parseDurationInDays', () => {
  it.each([
    ['90d', 90],
    ['6w', 42],
    ['3m', 90],
    ['1y', 365],
    ['30', 30],
    ['  12D  ', 12],
  ])('reads %j as %d days', (input, expected) => {
    expect(parseDurationInDays(input)).toBe(expected)
  })

  it.each(['', 'soon', '-5d', '1.5y', '90 days', 'd'])('rejects %j', (input) => {
    expect(() => parseDurationInDays(input)).toThrow(InvalidDurationError)
  })
})

describe('formatAge', () => {
  it.each([
    [0, '0d'],
    [59, '59d'],
    [60, '2mo'],
    [729, '24mo'],
    [730, '2y'],
    [undefined, 'unknown'],
  ])('formats %j as %j', (days, expected) => {
    expect(formatAge(days)).toBe(expected)
  })
})
