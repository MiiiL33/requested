---
'@requested/cli': patch
---

Report the real version from `requested --version`.

The version was hardcoded in the CLI source, so it went stale as soon as a release bumped `package.json` — the published 0.2.0 reported itself as 0.1.0. It is now injected from `package.json` at build time, so the two cannot drift again.
