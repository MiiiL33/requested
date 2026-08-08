# Requested

**Find and clear the Instagram follow requests you sent that were never answered.**

No login. No password. Nothing uploaded. Reads the official data export Instagram gives you, entirely on your own machine.

```
$ requested list --export ~/Downloads/instagram-export.zip --older-than 90d

   ACCOUNT           SENT        AGE
 1 ada_lovelace      2020-09-13  5y
 2 grace_hopper      2023-11-14  2y
 3 alan_turing       2025-06-15  13mo

3 unanswered follow requests · oldest 5y
```

---

## Why this exists

Instagram lets you send follow requests but gives you no way to see the ones still outstanding, and no way to cancel them in bulk. They accumulate silently for years.

Every other tool that solves this asks for your Instagram password and automates actions on your account — which violates Instagram's Terms of Use and risks your account being restricted or permanently suspended. That is also why those tools are only ever found on APK mirrors rather than the App Store.

**Requested takes the other path.** It reads the data export Instagram publishes to you, computes the answer locally, and hands you a resumable checklist. You stay in control of every action taken on your account, and your credentials are never involved.

## Install

```bash
npm install -g @requested/cli
```

## Get your data

Instagram → **Settings** → _Your activity_ → **Download your information** → Request download → format **JSON**, range **All time**.

It arrives by email, usually within a few hours.

## Use

```bash
# What is still outstanding?
requested list --export ~/Downloads/instagram-export.zip

# Only the truly forgotten ones
requested list --export ~/Downloads/instagram-export.zip --older-than 1y

# Pipe it somewhere
requested list --export ./export.zip --format json > pending.json

# Work through the backlog — opens each profile, remembers your place
requested open --export ~/Downloads/instagram-export.zip --older-than 90d
```

`open` walks one account at a time. Each opens in your browser; click **Requested**, confirm, press enter. Progress is saved after every answer, so you can stop and resume across several sittings.

## What it does that a plain file viewer doesn't

- **Reconciles against your following list.** A request in the export may have been accepted since the export was generated. Those are dropped, so you never cancel a request that already succeeded.
- **Survives Instagram's renames.** The parser locates entries by _shape_, not by key name. Instagram has renamed these keys before, and doing so silently breaks tools that hardcode them.
- **Sorts oldest first** and never guesses a date it doesn't have.

## Packages

| Package                                        | Purpose                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [`@requested/core`](packages/core)             | Pure domain logic. Zero dependencies, zero I/O — runs in Node, the browser and React Native alike.     |
| [`@requested/export`](packages/adapter-export) | Reads an export archive (`.zip` or folder) into a snapshot. `@requested/export/parse` is browser-safe. |
| [`@requested/cli`](packages/cli)               | This command-line tool.                                                                                |

The architecture is ports-and-adapters: `core` depends on nothing, and everything depends on `core`. That is what lets the same verified logic back a CLI today and a mobile app later without a rewrite.

## Development

```bash
pnpm install
pnpm verify      # lint, format, typecheck, test, build, boundary check
pnpm test
```

A real export takes hours to arrive and contains your actual social graph, so there is a synthetic one for development:

```bash
pnpm build
pnpm sample:export sample-export.zip
node packages/cli/dist/index.js list --export sample-export.zip
```

`pnpm check:boundaries` enforces the rules the project's compliance story rests on — notably that no store-publishable build can reach an automation adapter, even transitively.

## Scope and honesty

Instagram exposes **no official API** for sent follow requests — not for listing them, not for cancelling them. This tool therefore cannot cancel requests for you, and any tool that claims to is either automating your account against Instagram's terms or asking for credentials it should not have.

What it can do is tell you exactly which requests are outstanding and make clearing them fast.

## License

MIT
