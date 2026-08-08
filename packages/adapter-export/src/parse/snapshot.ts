import { buildProfileLinks, usernameFromProfileUrl } from '@requested/core'
import type { AccountSnapshot, PendingRequest } from '@requested/core'
import { collectRelationships, type RawRelationship } from './collect-entries.js'
import { MalformedExportError } from '../errors.js'

/**
 * Instagram writes seconds; anything past this is already milliseconds.
 * (Seconds-since-epoch will not reach 1e11 until the year 5138.)
 */
const MILLISECOND_THRESHOLD = 1e11

export interface SnapshotInput {
  readonly pendingJson: string
  /** Optional: without it, reconciliation is skipped and nothing is filtered out. */
  readonly followingJson?: string
}

export function buildSnapshot(input: SnapshotInput): AccountSnapshot {
  return {
    pendingRequests: parsePendingRequests(input.pendingJson),
    following: input.followingJson === undefined ? [] : parseFollowing(input.followingJson),
  }
}

export function parsePendingRequests(
  json: string,
  file = 'pending_follow_requests.json',
): PendingRequest[] {
  const requests: PendingRequest[] = []

  for (const relationship of collectRelationships(parseJson(json, file))) {
    const username = resolveUsername(relationship)
    if (username === undefined) continue

    const sentAt = resolveSentAt(relationship.timestamp)
    requests.push({
      username,
      // Most real records carry no URL, so it is synthesised from the handle.
      profileUrl: relationship.href ?? buildProfileLinks(username).web,
      ...(sentAt === undefined ? {} : { sentAt }),
    })
  }

  return requests
}

export function parseFollowing(json: string, file = 'following.json'): string[] {
  const usernames: string[] = []

  for (const relationship of collectRelationships(parseJson(json, file))) {
    const username = resolveUsername(relationship)
    if (username !== undefined) usernames.push(username)
  }

  return usernames
}

function parseJson(raw: string, file: string): unknown {
  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new MalformedExportError(file, error instanceof Error ? error.message : 'invalid JSON')
  }
}

function resolveUsername(relationship: RawRelationship): string | undefined {
  if (relationship.username !== undefined) return relationship.username
  return relationship.href === undefined ? undefined : usernameFromProfileUrl(relationship.href)
}

function resolveSentAt(timestamp: number | undefined): Date | undefined {
  if (timestamp === undefined || timestamp <= 0) return undefined

  const ms = timestamp > MILLISECOND_THRESHOLD ? timestamp : timestamp * 1000
  const date = new Date(ms)
  return Number.isNaN(date.getTime()) ? undefined : date
}
