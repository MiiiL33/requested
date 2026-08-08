import { defineConfig } from 'tsup'

export default defineConfig({
  // `parse` is a separate entry so the future web app can import the pure,
  // browser-safe parsing layer without pulling in `node:fs`.
  entry: ['src/index.ts', 'src/parse.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
})
