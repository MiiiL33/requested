#!/usr/bin/env node
/**
 * Fails if any Markdown file other than README.md is tracked by git.
 *
 * This repository is public. Working notes, plans, agent instructions
 * (CLAUDE.md, AGENTS.md) and RAG-style context files describe how the project
 * is built rather than how it is used — none of that belongs in a public
 * repo, and .gitignore alone does not stop `git add -f` or a renamed file.
 * So the rule is checked in CI instead of trusted.
 *
 * To allow another Markdown file, add it to ALLOWED deliberately.
 */
import { execFileSync } from 'node:child_process'

const ALLOWED = new Set(['README.md'])

const tracked = execFileSync('git', ['ls-files', '*.md', '**/*.md'], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '')

const offenders = tracked.filter((file) => !ALLOWED.has(file))

if (offenders.length > 0) {
  console.error('Tracked Markdown files that are not allowed:\n')
  for (const file of offenders) console.error(`  ✗ ${file}`)
  console.error('\nOnly README.md may be committed. Remove these with:')
  console.error(`  git rm --cached ${offenders.join(' ')}\n`)
  process.exit(1)
}

console.log(`✓ docs ok (${tracked.length} tracked markdown file(s), all allowed)`)
