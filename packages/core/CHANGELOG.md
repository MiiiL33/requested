# @requested/core

## 0.2.1

### Patch Changes

- 2fc256b: Add repository, homepage and bugs metadata.

  These link the npm listings back to the source and are required for provenance attestation under npm trusted publishing.

## 0.2.0

### Minor Changes

- 2bedc50: Initial release.

  - `@requested/core` — pure domain logic: reconciliation against your following list, age filtering, oldest-first ordering, and a resumable `CancellationQueue`. Zero dependencies, zero I/O.
  - `@requested/export` — reads an Instagram data export (`.zip` or folder), locating files by shape rather than by Instagram's version-specific key names. `@requested/export/parse` is browser-safe.
  - `@requested/cli` — `requested list` and `requested open`.
