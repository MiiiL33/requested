---
'@requested/core': minor
'@requested/export': minor
'@requested/cli': minor
---

Initial release.

- `@requested/core` — pure domain logic: reconciliation against your following list, age filtering, oldest-first ordering, and a resumable `CancellationQueue`. Zero dependencies, zero I/O.
- `@requested/export` — reads an Instagram data export (`.zip` or folder), locating files by shape rather than by Instagram's version-specific key names. `@requested/export/parse` is browser-safe.
- `@requested/cli` — `requested list` and `requested open`.
