#!/usr/bin/env node
/**
 * Fails if git is tracking Markdown that describes *the project* rather than
 * *how to use it*.
 *
 * This repository is public. Plans, roadmaps, decision logs, working notes and
 * agent context files (CLAUDE.md, AGENTS.md) live in `docs/`, which is
 * gitignored and stays local. Release artefacts — README, CHANGELOGs and
 * changeset files — are legitimate and allowed.
 *
 * Checked in CI rather than trusted to .gitignore, because ignoring a file
 * does not stop `git add -f` or a rename.
 */
import { execFileSync } from 'node:child_process'

/** Markdown that is genuinely part of the published product. */
const ALLOWED = [
  { label: 'README.md at the repo root', test: (file) => file === 'README.md' },
  { label: 'package CHANGELOGs', test: (file) => file.endsWith('CHANGELOG.md') },
  { label: 'changeset files', test: (file) => file.startsWith('.changeset/') },
]

/** Always rejected, even if someone adds an ALLOWED rule that would match. */
const NEVER = [
  { label: 'docs/ is local-only', test: (file) => file.startsWith('docs/') },
  {
    label: 'agent/assistant context files',
    test: (file) => /(^|\/)(CLAUDE|AGENTS|GEMINI)\.md$/i.test(file),
  },
]

const tracked = execFileSync('git', ['ls-files', '*.md', '**/*.md'], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '')

const offenders = []
for (const file of tracked) {
  const banned = NEVER.find((rule) => rule.test(file))
  if (banned !== undefined) {
    offenders.push({ file, reason: banned.label })
    continue
  }
  if (!ALLOWED.some((rule) => rule.test(file))) {
    offenders.push({ file, reason: 'not an allowed documentation file' })
  }
}

if (offenders.length > 0) {
  console.error('Tracked Markdown that must not be committed:\n')
  for (const { file, reason } of offenders) console.error(`  ✗ ${file} — ${reason}`)
  console.error('\nProject plans and notes belong in docs/ (gitignored). Untrack with:')
  console.error(`  git rm --cached ${offenders.map((entry) => entry.file).join(' ')}\n`)
  process.exit(1)
}

console.log(`✓ docs ok (${tracked.length} tracked markdown file(s), all allowed)`)
