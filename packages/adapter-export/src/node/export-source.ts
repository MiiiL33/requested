import type { AccountSnapshot, RequestSource } from '@requested/core'
import { openArchive } from './archive.js'
import { buildSnapshot } from '../parse/snapshot.js'
import { HtmlExportError, PendingRequestsNotFoundError } from '../errors.js'

const PENDING_JSON = 'pending_follow_requests.json'
const PENDING_HTML = 'pending_follow_requests.html'
const FOLLOWING_JSON = 'following.json'
const FOLLOWING_HTML = 'following.html'

const WANTED = new Set([PENDING_JSON, PENDING_HTML, FOLLOWING_JSON, FOLLOWING_HTML])

/**
 * Reads an Instagram data export from disk (.zip or unzipped folder).
 *
 * Files are located by basename anywhere in the archive rather than by a fixed
 * path, because Instagram has moved these between `connections/` and
 * `followers_and_following/` across export versions.
 */
export class InstagramExportSource implements RequestSource {
  constructor(private readonly path: string) {}

  async load(): Promise<AccountSnapshot> {
    const archive = await openArchive(this.path)
    const files = await archive.extract(WANTED)

    const pendingJson = files.get(PENDING_JSON)
    if (pendingJson === undefined) {
      if (files.has(PENDING_HTML) || files.has(FOLLOWING_HTML)) throw new HtmlExportError()
      throw new PendingRequestsNotFoundError()
    }

    const followingJson = files.get(FOLLOWING_JSON)
    return buildSnapshot({
      pendingJson,
      ...(followingJson === undefined ? {} : { followingJson }),
    })
  }
}
