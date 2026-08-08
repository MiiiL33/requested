/**
 * Every failure the user can realistically hit gets its own type with an
 * actionable message. Export archives vary a lot between Instagram versions,
 * so "something went wrong" is never good enough here.
 */
export class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class ExportNotFoundError extends ExportError {
  constructor(path: string) {
    super(
      `No export found at ${path}. Pass the .zip Instagram emailed you, or the folder you unzipped it to.`,
    )
  }
}

/** The user picked "HTML" instead of "JSON" when requesting their download. */
export class HtmlExportError extends ExportError {
  constructor() {
    super(
      'This export is in HTML format, which cannot be parsed reliably.\n' +
        'Request a new download from Instagram and choose JSON:\n' +
        '  Settings -> Your activity -> Download your information -> Format: JSON',
    )
  }
}

export class PendingRequestsNotFoundError extends ExportError {
  constructor() {
    super(
      'This export contains no pending_follow_requests file.\n' +
        'Instagram only includes it when you have outstanding sent requests — ' +
        'if you are sure you have some, request a fresh export covering "All time".',
    )
  }
}

export class MalformedExportError extends ExportError {
  constructor(file: string, cause: string) {
    super(`Could not read ${file}: ${cause}`)
  }
}
