const DAYS_PER_UNIT: Record<string, number> = {
  d: 1,
  w: 7,
  m: 30,
  y: 365,
}

export class InvalidDurationError extends Error {
  constructor(input: string) {
    super(`Could not read "${input}" as a duration. Try 90d, 6w, 3m or 1y.`)
    this.name = 'InvalidDurationError'
  }
}

/** Parses `90d`, `6w`, `3m`, `1y`, or a bare number of days. */
export function parseDurationInDays(input: string): number {
  const match = /^(\d+)\s*([dwmy])?$/i.exec(input.trim())
  if (match === null) throw new InvalidDurationError(input)

  const amount = Number(match[1])
  const unit = (match[2] ?? 'd').toLowerCase()
  const perUnit = DAYS_PER_UNIT[unit]
  if (perUnit === undefined) throw new InvalidDurationError(input)

  return amount * perUnit
}

/** Compact, human-scannable age: `12d`, `7mo`, `5y`. */
export function formatAge(days: number | undefined): string {
  if (days === undefined) return 'unknown'
  if (days < 60) return `${days}d`
  if (days < 730) return `${Math.floor(days / 30)}mo`
  return `${Math.floor(days / 365)}y`
}
