import { Command, InvalidArgumentError } from 'commander'
import pc from 'picocolors'
import { ExportError } from '@requested/export'
import { runList, type OutputFormat } from './commands/list.js'
import { runOpen } from './commands/open.js'
import { InvalidDurationError } from './duration.js'
import { CliError } from './errors.js'

const FORMATS: readonly string[] = ['table', 'json', 'csv']

function parseFormat(value: string): OutputFormat {
  if (!FORMATS.includes(value)) {
    throw new InvalidArgumentError(`Expected one of ${FORMATS.join(', ')}.`)
  }
  return value as OutputFormat
}

const program = new Command()

program
  .name('requested')
  .description(
    'Find and clear the Instagram follow requests you sent that were never answered.\n' +
      'Reads your official Instagram data export locally. No login, no password, nothing uploaded.',
  )
  .version('0.1.0')
  .showHelpAfterError()

const exportOption = [
  '-e, --export <path>',
  'Instagram data export (.zip or unzipped folder)',
] as const
const olderThanOption = [
  '-o, --older-than <duration>',
  'only requests at least this old, e.g. 90d, 6w, 1y',
] as const

program
  .command('list')
  .description('List the follow requests you sent that were never answered')
  .requiredOption(...exportOption)
  .option(...olderThanOption)
  .option('-f, --format <format>', 'table, json or csv', parseFormat, 'table')
  .action(async (options: { export: string; olderThan?: string; format: OutputFormat }) =>
    runList(options),
  )

program
  .command('open')
  .description('Walk the backlog one account at a time, resuming where you left off')
  .requiredOption(...exportOption)
  .option(...olderThanOption)
  .option('--reset', 'discard saved progress and start over')
  .action(async (options: { export: string; olderThan?: string; reset?: boolean }) =>
    runOpen(options),
  )

// Wrapped in a function rather than left as a top-level await: if a promise
// here never settles, top-level await reports only "Detected unsettled
// top-level await" and hides whatever actually went wrong.
async function main(): Promise<void> {
  try {
    await program.parseAsync(process.argv)
  } catch (error) {
    // Expected, user-actionable failures print a message; everything else keeps
    // its stack trace, because an unexpected crash is a bug we want reported.
    if (
      error instanceof ExportError ||
      error instanceof InvalidDurationError ||
      error instanceof CliError
    ) {
      process.stderr.write(`\n${pc.red('✗')} ${error.message}\n\n`)
      process.exitCode = 1
      return
    }
    throw error
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`\n${pc.red('✗')} Unexpected error\n`)
  console.error(error)
  process.exitCode = 1
})
