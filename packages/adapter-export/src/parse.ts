/**
 * Browser-safe entry point: pure parsing, no `node:` imports.
 *
 * The planned web app imports this to parse a dropped ZIP entirely client-side,
 * which is what lets the product promise that your data never leaves the device.
 */
export {
  collectStringListData,
  StringListDatumSchema,
  type StringListDatum,
} from './parse/collect-entries.js'

export {
  buildSnapshot,
  parseFollowing,
  parsePendingRequests,
  type SnapshotInput,
} from './parse/snapshot.js'

export {
  ExportError,
  ExportNotFoundError,
  HtmlExportError,
  MalformedExportError,
  PendingRequestsNotFoundError,
} from './errors.js'
