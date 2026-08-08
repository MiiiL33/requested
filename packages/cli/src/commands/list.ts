import { renderCsv, renderJson, renderTable, summarize } from '../render.js'
import { loadRequests, type LoadOptions } from './load-requests.js'

export type OutputFormat = 'table' | 'json' | 'csv'

export interface ListOptions extends LoadOptions {
  readonly format: OutputFormat
}

export async function runList(options: ListOptions): Promise<void> {
  const requests = await loadRequests(options)

  // Machine formats emit data and nothing else, so the command stays pipeable.
  if (options.format === 'json') {
    process.stdout.write(`${renderJson(requests)}\n`)
    return
  }
  if (options.format === 'csv') {
    process.stdout.write(`${renderCsv(requests)}\n`)
    return
  }

  if (requests.length > 0) {
    process.stdout.write(`${renderTable(requests)}\n\n`)
  }
  process.stdout.write(`${summarize(requests)}\n`)
}
