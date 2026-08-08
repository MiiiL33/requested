/** A failure the user can act on. Printed as a message, never as a stack trace. */
export class CliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

/**
 * `open` asks you to confirm each account, so it needs a real terminal.
 *
 * Without this check the readline prompt simply never resolves — Node drains
 * the event loop and reports "Detected unsettled top-level await", which says
 * nothing about the actual problem. Common causes: running through an editor's
 * command runner, a CI job, or a pipe.
 */
export class InteractiveTerminalRequiredError extends CliError {
  constructor() {
    super(
      'This command is interactive and needs a real terminal.\n\n' +
        'Run it directly in your terminal — not through a pipe, a CI job, or an\n' +
        "editor's command runner.\n\n" +
        'For a non-interactive list of what would be opened:\n' +
        '  requested list --export <path> [--older-than 5y]',
    )
  }
}
