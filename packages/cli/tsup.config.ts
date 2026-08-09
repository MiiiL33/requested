import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

// The version is injected from package.json at build time rather than written
// into the source. A hardcoded literal silently goes stale the moment a release
// bumps package.json, and `requested --version` then lies about what is running.
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  target: 'es2022',
  banner: { js: '#!/usr/bin/env node' },
  define: { __CLI_VERSION__: JSON.stringify(version) },
})
