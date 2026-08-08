import { createInterface } from 'node:readline/promises'
import pc from 'picocolors'
import { CancellationQueue, buildProfileLinks } from '@requested/core'
import type { QueueProgress } from '@requested/core'
import { loadRequests, type LoadOptions } from './load-requests.js'
import { clearQueueState, loadQueueState, saveQueueState } from '../queue-store.js'
import { openUrl } from '../open-url.js'
import { formatAge } from '../duration.js'
import { InteractiveTerminalRequiredError } from '../errors.js'

export interface OpenOptions extends LoadOptions {
  readonly reset?: boolean
}

/**
 * Walks the backlog one account at a time: open, you cancel, next.
 *
 * Instagram has no bulk cancel, so this is the honest ceiling for a tool that
 * does not touch your credentials. Progress is saved after every answer, so a
 * few hundred requests can be cleared across several sittings.
 */
export async function runOpen(options: OpenOptions): Promise<void> {
  // Checked before any work: failing fast with an explanation beats loading an
  // export and then hanging on a prompt nobody can answer.
  if (process.stdin.isTTY !== true) throw new InteractiveTerminalRequiredError()

  const requests = await loadRequests(options)

  if (requests.length === 0) {
    process.stdout.write(pc.green('No unanswered follow requests. Nothing to clear.\n'))
    return
  }

  if (options.reset === true) await clearQueueState()
  const saved = options.reset === true ? undefined : await loadQueueState()

  let queue =
    saved === undefined
      ? CancellationQueue.start(requests)
      : CancellationQueue.restore(saved, requests)

  printIntro(queue.progress)

  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  let quit = false

  try {
    while (!queue.isComplete) {
      const current = queue.current
      if (current === undefined) break

      const { total, cancelled, skipped } = queue.progress
      const links = buildProfileLinks(current.username)

      process.stdout.write(
        `\n${pc.dim(`[${cancelled + skipped + 1}/${total}]`)} ${pc.bold(current.username)}` +
          `${pc.dim(` · requested ${formatAge(current.ageInDays)} ago`)}\n` +
          `${pc.dim(links.web)}\n`,
      )
      openUrl(links.web)

      // Ctrl-D, a closed pipe, or any other end of stdin resolves as "stop
      // here" — progress is already on disk, so quitting is always safe.
      let answer: string
      try {
        answer = (
          await prompt.question(pc.dim('  [enter] done · [s] skip · [o] reopen · [q] quit  '))
        )
          .trim()
          .toLowerCase()
      } catch {
        quit = true
        break
      }

      if (answer === 'q') {
        quit = true
        break
      }
      if (answer === 'o') continue

      queue = answer === 's' ? queue.markSkipped() : queue.markCancelled()
      await saveQueueState(queue.toState())
    }
  } finally {
    prompt.close()
  }

  await report(queue, quit)
}

function printIntro(progress: QueueProgress): void {
  const resumed = progress.cancelled + progress.skipped

  process.stdout.write(
    `\n${pc.bold(`${progress.remaining} request${progress.remaining === 1 ? '' : 's'} to clear`)}` +
      (resumed > 0 ? pc.dim(` (resuming — ${resumed} already handled)`) : '') +
      '\n' +
      pc.dim('Each account opens in your browser. Click “Requested”, confirm, then press enter.\n'),
  )
}

async function report(queue: CancellationQueue, quit: boolean): Promise<void> {
  const { cancelled, skipped, remaining } = queue.progress

  if (queue.isComplete) {
    await clearQueueState()
    process.stdout.write(
      `\n${pc.green('✓')} Backlog cleared — ${cancelled} cancelled, ${skipped} skipped.\n`,
    )
    return
  }

  if (quit) {
    process.stdout.write(
      `\n${pc.dim(`Stopped. ${remaining} left — run the same command again to resume.`)}\n`,
    )
  }
}
