#!/usr/bin/env node
/**
 * Publishes the workspace packages to npm.
 *
 * Why this exists instead of `changeset publish`:
 *
 *   1. `pnpm publish` cannot authenticate via OIDC on pnpm 11 (pnpm/pnpm#11513),
 *      and this repo is on pnpm 11.
 *   2. `changesets/action` publishing scoped packages over OIDC fails with a
 *      misleading E404 (npm/cli#8976), and every package here is scoped.
 *
 * So it splits the job the way it actually works:
 *   - `pnpm pack` builds the tarball, rewriting `workspace:*` into real
 *     versions. npm does not understand the workspace protocol and would
 *     publish an uninstallable package.
 *   - `npm publish <tarball>` does the upload, because npm is the client that
 *     supports trusted publishing (OIDC). Requires npm >= 11.5.1.
 *
 * Idempotent: versions already on the registry are skipped, so a re-run after a
 * partial failure finishes the job rather than erroring out.
 *
 *   node scripts/publish-packages.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES_DIR = join(ROOT, 'packages')
const DRY_RUN = process.argv.includes('--dry-run')

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options })
}

function loadPackages() {
  const found = []

  for (const entry of readdirSync(PACKAGES_DIR)) {
    const dir = join(PACKAGES_DIR, entry)
    let manifest
    try {
      manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
    } catch {
      continue
    }
    if (manifest.private === true) continue

    found.push({
      name: manifest.name,
      version: manifest.version,
      dir,
      workspaceDeps: Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }),
    })
  }

  return found
}

/** Dependencies must exist on the registry before their dependents reference them. */
function inDependencyOrder(packages) {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))
  const ordered = []
  const seen = new Set()

  const visit = (pkg) => {
    if (seen.has(pkg.name)) return
    seen.add(pkg.name)
    for (const dependency of pkg.workspaceDeps) {
      const local = byName.get(dependency)
      if (local !== undefined) visit(local)
    }
    ordered.push(pkg)
  }

  for (const pkg of packages) visit(pkg)
  return ordered
}

function isAlreadyPublished(name, version) {
  try {
    run('npm', ['view', `${name}@${version}`, 'version'])
    return true
  } catch {
    return false
  }
}

const packages = inDependencyOrder(loadPackages())
const staging = mkdtempSync(join(tmpdir(), 'requested-publish-'))
const published = []
const skipped = []

console.log(`Publishing ${packages.length} package(s)${DRY_RUN ? ' (dry run)' : ''}\n`)

for (const pkg of packages) {
  if (isAlreadyPublished(pkg.name, pkg.version)) {
    console.log(`  - ${pkg.name}@${pkg.version} already on the registry, skipping`)
    skipped.push(pkg.name)
    continue
  }

  // pnpm pack, so `workspace:*` becomes a real version range.
  const output = run('pnpm', ['pack', '--pack-destination', staging], { cwd: pkg.dir })
  const tarball = output.trim().split('\n').pop()

  if (DRY_RUN) {
    const packed = JSON.parse(run('tar', ['-xzOf', tarball, 'package/package.json']))
    console.log(`  · ${pkg.name}@${pkg.version} packed`)
    console.log(`    deps: ${JSON.stringify(packed.dependencies ?? {})}`)
    continue
  }

  // npm publish, because npm is the client that supports OIDC.
  run('npm', ['publish', tarball, '--access', 'public'], { stdio: 'inherit' })
  console.log(`  ✓ ${pkg.name}@${pkg.version} published`)
  published.push(pkg.name)
}

console.log(
  `\n${DRY_RUN ? 'Dry run complete' : `Published ${published.length}, skipped ${skipped.length}`}.`,
)
