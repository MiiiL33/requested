import pc from 'picocolors'
import type { UnansweredRequest } from '@requested/core'
import { formatAge } from './duration.js'

export function renderTable(requests: readonly UnansweredRequest[]): string {
  const rows = requests.map((request, index) => ({
    index: String(index + 1),
    username: request.username,
    sent: formatDate(request.sentAt),
    age: formatAge(request.ageInDays),
  }))

  const width = {
    index: widest(rows.map((row) => row.index)),
    username: widest([...rows.map((row) => row.username), 'ACCOUNT']),
    sent: widest([...rows.map((row) => row.sent), 'SENT']),
  }

  const header = pc.dim(
    [
      ''.padStart(width.index),
      'ACCOUNT'.padEnd(width.username),
      'SENT'.padEnd(width.sent),
      'AGE',
    ].join('  '),
  )

  const body = rows.map((row) =>
    [
      pc.dim(row.index.padStart(width.index)),
      row.username.padEnd(width.username),
      pc.dim(row.sent.padEnd(width.sent)),
      pc.yellow(row.age),
    ].join('  '),
  )

  return [header, ...body].join('\n')
}

export function renderJson(requests: readonly UnansweredRequest[]): string {
  return JSON.stringify(
    requests.map((request) => ({
      username: request.username,
      profileUrl: request.profileUrl,
      sentAt: request.sentAt?.toISOString() ?? null,
      ageInDays: request.ageInDays ?? null,
    })),
    null,
    2,
  )
}

export function renderCsv(requests: readonly UnansweredRequest[]): string {
  const lines = ['username,profile_url,sent_at,age_in_days']

  for (const request of requests) {
    lines.push(
      [
        csvField(request.username),
        csvField(request.profileUrl),
        csvField(request.sentAt?.toISOString() ?? ''),
        csvField(request.ageInDays === undefined ? '' : String(request.ageInDays)),
      ].join(','),
    )
  }

  return lines.join('\n')
}

export function summarize(requests: readonly UnansweredRequest[]): string {
  if (requests.length === 0) return pc.green('No unanswered follow requests. Nothing to clear.')

  const oldest = requests[0]?.ageInDays
  const noun = requests.length === 1 ? 'request' : 'requests'
  const suffix = oldest === undefined ? '' : pc.dim(` · oldest ${formatAge(oldest)}`)

  return `${pc.bold(String(requests.length))} unanswered follow ${noun}${suffix}`
}

function formatDate(date: Date | undefined): string {
  return date?.toISOString().slice(0, 10) ?? '—'
}

function widest(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, value.length), 0)
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}
