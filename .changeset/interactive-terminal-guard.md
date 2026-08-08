---
'@requested/cli': patch
---

Fail with a clear message when `requested open` has no interactive terminal.

`open` asks you to confirm each account, so it needs a real TTY. Run through a pipe, a CI job or an editor's command runner, the readline prompt simply never resolved and Node reported `Detected unsettled top-level await` — which says nothing about the actual problem. The terminal is now checked before the export is loaded, so the command fails fast and points at `requested list` for non-interactive use.

The CLI entry point no longer uses a bare top-level await, so an unsettled promise can never again mask the real error.
