#!/usr/bin/env node
/**
 * Enforces the architectural rules the product's compliance story rests on.
 *
 * The important one: no store-publishable build may depend, even transitively,
 * on the automation adapter. Apple rejects apps that alter third-party social
 * accounts (Guideline 5.2.2), and Instagram's ToS forbids automated actions —
 * so "the app cannot automate" needs to be a checkable fact about the
 * dependency graph, not a line in a README that drifts.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKSPACE_DIRS = ['packages', 'apps']

const CORE = '@requested/core'
const AUTOMATION = '@requested/auto'

const packages = await loadWorkspacePackages()
const violations = []

// 1. The core must stay dependency-free so it runs unchanged in Node, the
//    browser and React Native.
const core = packages.get(CORE)
if (core !== undefined && Object.keys(core.dependencies).length > 0) {
  violations.push(
    `${CORE} must have zero runtime dependencies, found: ${Object.keys(core.dependencies).join(', ')}`,
  )
}

// 2. Nothing shippable to an app store may reach the automation adapter.
for (const pkg of packages.values()) {
  if (pkg.workspace !== 'apps') continue

  const reached = resolveTransitive(pkg.name, packages)
  if (reached.has(AUTOMATION)) {
    violations.push(
      `${pkg.name} (apps/) depends on ${AUTOMATION}. Store builds must never include automation.`,
    )
  }
}

// 3. Adapters stay leaves — they must not reach back into the CLI.
for (const name of ['@requested/export', AUTOMATION]) {
  const pkg = packages.get(name)
  if (pkg !== undefined && '@requested/cli' in pkg.dependencies) {
    violations.push(`${name} must not depend on @requested/cli.`)
  }
}

if (violations.length > 0) {
  console.error('Architecture boundary violations:\n')
  for (const violation of violations) console.error(`  ✗ ${violation}`)
  console.error('')
  process.exit(1)
}

console.log(`✓ boundaries ok (${packages.size} workspace packages checked)`)

async function loadWorkspacePackages() {
  const found = new Map()

  for (const workspace of WORKSPACE_DIRS) {
    const base = join(ROOT, workspace)
    let entries
    try {
      entries = await readdir(base)
    } catch {
      continue // `apps/` does not exist yet.
    }

    for (const entry of entries) {
      const manifestPath = join(base, entry, 'package.json')
      try {
        await stat(manifestPath)
      } catch {
        continue
      }

      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
      found.set(manifest.name, {
        name: manifest.name,
        workspace,
        dependencies: { ...manifest.dependencies, ...manifest.peerDependencies },
      })
    }
  }

  return found
}

function resolveTransitive(name, all) {
  const reached = new Set()
  const queue = [name]

  while (queue.length > 0) {
    const current = queue.pop()
    const pkg = all.get(current)
    if (pkg === undefined) continue

    for (const dependency of Object.keys(pkg.dependencies)) {
      if (reached.has(dependency)) continue
      reached.add(dependency)
      queue.push(dependency)
    }
  }

  return reached
}
