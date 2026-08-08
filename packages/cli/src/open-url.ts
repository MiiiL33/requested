import { spawn } from 'node:child_process'

/**
 * Opens a URL in the user's default browser.
 *
 * Note the CLI deliberately uses the https profile link rather than the
 * `instagram://` scheme: it runs on desktops, where the app scheme resolves to
 * nothing. Mobile builds are the ones that want the app scheme.
 */
export function openUrl(url: string): void {
  const { command, args } = opener(url)
  // No shell — the URL is never interpolated into a command line.
  spawn(command, args, { stdio: 'ignore', detached: true }).unref()
}

function opener(url: string): { command: string; args: string[] } {
  switch (process.platform) {
    case 'darwin':
      return { command: 'open', args: [url] }
    case 'win32':
      return { command: 'cmd', args: ['/c', 'start', '', url] }
    default:
      return { command: 'xdg-open', args: [url] }
  }
}
