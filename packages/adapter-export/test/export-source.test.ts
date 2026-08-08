import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { fixedClock, findUnansweredRequests } from '@requested/core'
import { InstagramExportSource } from '../src/node/export-source.js'
import {
  ExportNotFoundError,
  HtmlExportError,
  PendingRequestsNotFoundError,
} from '../src/errors.js'
import {
  followingJson,
  pendingFollowRequestsHtml,
  pendingFollowRequestsJson,
} from './fixtures/synthetic-export.js'

const EXPORT_DIR = 'connections/followers_and_following'

let workspace: string

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'requested-'))
})

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true })
})

async function writeExportDir(files: Record<string, string>): Promise<string> {
  const root = join(workspace, 'export')
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  return root
}

async function writeExportZip(files: Record<string, string>): Promise<string> {
  const payload = Object.fromEntries(
    Object.entries(files).map(([path, contents]) => [path, strToU8(contents)]),
  )
  const target = join(workspace, 'export.zip')
  await writeFile(target, zipSync(payload))
  return target
}

const completeExport = {
  [`${EXPORT_DIR}/pending_follow_requests.json`]: pendingFollowRequestsJson,
  [`${EXPORT_DIR}/following.json`]: followingJson,
}

describe('InstagramExportSource', () => {
  it('loads an unzipped export folder', async () => {
    const path = await writeExportDir(completeExport)

    const snapshot = await new InstagramExportSource(path).load()

    expect(snapshot.pendingRequests).toHaveLength(4)
    expect(snapshot.following).toContain('katherine_j')
  })

  it('loads a .zip export without unpacking it first', async () => {
    const path = await writeExportZip(completeExport)

    const snapshot = await new InstagramExportSource(path).load()

    expect(snapshot.pendingRequests).toHaveLength(4)
    expect(snapshot.following).toContain('katherine_j')
  })

  it('locates the files wherever Instagram put them in this export version', async () => {
    const path = await writeExportDir({
      'some/other/layout/pending_follow_requests.json': pendingFollowRequestsJson,
      'elsewhere/following.json': followingJson,
    })

    await expect(new InstagramExportSource(path).load()).resolves.toMatchObject({
      following: ['katherine_j', 'margaret_h'],
    })
  })

  it('produces a reconciled, oldest-first list end to end', async () => {
    const path = await writeExportZip(completeExport)
    const snapshot = await new InstagramExportSource(path).load()

    const unanswered = findUnansweredRequests(snapshot, {
      clock: fixedClock(new Date('2026-08-08T00:00:00.000Z')),
    })

    // katherine_j was accepted between the export and now, so she is gone.
    expect(unanswered.map((request) => request.username)).toEqual([
      'ada_lovelace',
      'grace_hopper',
      'alan_turing',
    ])
  })

  describe('failure modes', () => {
    it('explains how to re-request the export when it is HTML', async () => {
      const path = await writeExportDir({
        [`${EXPORT_DIR}/pending_follow_requests.html`]: pendingFollowRequestsHtml,
      })

      await expect(new InstagramExportSource(path).load()).rejects.toBeInstanceOf(HtmlExportError)
    })

    it('detects an HTML export even when the pending file itself is absent', async () => {
      const path = await writeExportDir({
        [`${EXPORT_DIR}/following.html`]: pendingFollowRequestsHtml,
      })

      await expect(new InstagramExportSource(path).load()).rejects.toBeInstanceOf(HtmlExportError)
    })

    it('reports when the export carries no pending-requests file', async () => {
      const path = await writeExportDir({ [`${EXPORT_DIR}/following.json`]: followingJson })

      await expect(new InstagramExportSource(path).load()).rejects.toBeInstanceOf(
        PendingRequestsNotFoundError,
      )
    })

    it('reports a missing export path', async () => {
      const source = new InstagramExportSource(join(workspace, 'nope.zip'))

      await expect(source.load()).rejects.toBeInstanceOf(ExportNotFoundError)
    })
  })
})
