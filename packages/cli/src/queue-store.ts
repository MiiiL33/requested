import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { QueueState } from '@requested/core'

const STATE_DIR = join(homedir(), '.requested')
const STATE_FILE = join(STATE_DIR, 'queue.json')

export const queueStatePath = STATE_FILE

/**
 * Clearing a long backlog spans several sittings, so queue progress outlives
 * the process. A corrupt or unrecognised file is treated as "no saved
 * progress" rather than a crash — losing your place is annoying, but being
 * unable to start at all is worse.
 */
export async function loadQueueState(): Promise<QueueState | undefined> {
  let raw: string
  try {
    raw = await readFile(STATE_FILE, 'utf8')
  } catch {
    return undefined
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isQueueState(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export async function saveQueueState(state: QueueState): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true })
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2))
}

export async function clearQueueState(): Promise<void> {
  await rm(STATE_FILE, { force: true })
}

function isQueueState(value: unknown): value is QueueState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<QueueState>

  return (
    candidate.version === 1 &&
    Array.isArray(candidate.entries) &&
    candidate.entries.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.username === 'string' &&
        (entry.status === 'pending' || entry.status === 'cancelled' || entry.status === 'skipped'),
    )
  )
}
