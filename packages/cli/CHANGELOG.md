# @requested/cli

## 0.2.1

### Patch Changes

- 2fc256b: Add repository, homepage and bugs metadata.

  These link the npm listings back to the source and are required for provenance attestation under npm trusted publishing.

- dc83827: Report the real version from `requested --version`.

  The version was hardcoded in the CLI source, so it went stale as soon as a release bumped `package.json` — the published 0.2.0 reported itself as 0.1.0. It is now injected from `package.json` at build time, so the two cannot drift again.

- Updated dependencies [2fc256b]
  - @requested/core@0.2.1
  - @requested/export@0.2.1

## 0.2.0

### Minor Changes

- 2bedc50: Initial release.

  - `@requested/core` — pure domain logic: reconciliation against your following list, age filtering, oldest-first ordering, and a resumable `CancellationQueue`. Zero dependencies, zero I/O.
  - `@requested/export` — reads an Instagram data export (`.zip` or folder), locating files by shape rather than by Instagram's version-specific key names. `@requested/export/parse` is browser-safe.
  - `@requested/cli` — `requested list` and `requested open`.

### Patch Changes

- 9ac2e58: Fail with a clear message when `requested open` has no interactive terminal.

  `open` asks you to confirm each account, so it needs a real TTY. Run through a pipe, a CI job or an editor's command runner, the readline prompt simply never resolved and Node reported `Detected unsettled top-level await` — which says nothing about the actual problem. The terminal is now checked before the export is loaded, so the command fails fast and points at `requested list` for non-interactive use.

  The CLI entry point no longer uses a bare top-level await, so an unsettled promise can never again mask the real error.

- Updated dependencies [2bedc50]
- Updated dependencies [5868b55]
  - @requested/core@0.2.0
  - @requested/export@0.2.0
