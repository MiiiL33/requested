import { afterEach, describe, expect, it } from 'vitest'
import { runOpen } from '../src/commands/open.js'
import { InteractiveTerminalRequiredError } from '../src/errors.js'

describe('runOpen', () => {
  const original = process.stdin.isTTY

  afterEach(() => {
    process.stdin.isTTY = original
  })

  it('refuses to run without an interactive terminal', async () => {
    process.stdin.isTTY = false

    await expect(runOpen({ export: '/nonexistent/export.zip' })).rejects.toBeInstanceOf(
      InteractiveTerminalRequiredError,
    )
  })

  it('checks for a terminal before touching the export', async () => {
    process.stdin.isTTY = false

    // The path does not exist. Getting the terminal error rather than a
    // "no export found" error proves nothing is loaded before the check —
    // otherwise the command would do real work and then hang on a prompt
    // nobody can answer.
    await expect(runOpen({ export: '/nonexistent/export.zip' })).rejects.toThrow(
      /needs a real terminal/,
    )
  })
})
