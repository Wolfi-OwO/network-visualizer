#!/usr/bin/env node
// Writes one version into every file that records it.
//
//   node scripts/set-version.mjs 2.5.0
//
// This is the write side of scripts/check-version-sync.mjs — the two share the same
// list of targets, and the same source of truth (version.txt). Publishing a GitHub
// Release runs this (see .github/workflows/release.yml), so the version in the repo is
// derived from the tag you released, never typed by hand. That is the bug this repo
// actually hit: tag v2.3.0 while application/package.json still said 1.0.0, invisible
// from outside because the build injects the version from the tag.
//
// Formatting note: package.json / package-lock.json are re-serialised with
// JSON.stringify(..., 2) + a trailing newline, which is exactly what npm writes.

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const abs = (p) => join(root, p)
const readJson = (p) => JSON.parse(readFileSync(abs(p), 'utf8'))
const writeJson = (p, data) => writeFileSync(abs(p), `${JSON.stringify(data, null, 2)}\n`)

const version = process.argv[2]

if (!version) {
  console.error('usage: node scripts/set-version.mjs <x.y.z>')
  process.exit(1)
}
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`error: "${version}" is not a semver version (expected x.y.z).`)
  process.exit(1)
}

const PACKAGES = [
  'application/package.json',
  'application/package-lock.json',
  'application/client/package.json',
  'application/client/package-lock.json',
]

const changed = []

// version.txt is the source of truth check-version-sync.mjs compares against.
const VERSION_TXT = 'version.txt'
if (readFileSync(abs(VERSION_TXT), 'utf8').trim() !== version) {
  changed.push(`${VERSION_TXT} -> ${version}`)
  writeFileSync(abs(VERSION_TXT), `${version}\n`)
}

for (const file of PACKAGES) {
  const pkg = readJson(file)
  let touched = false

  if (pkg.version !== version) {
    changed.push(`${file} (.version): ${pkg.version} -> ${version}`)
    pkg.version = version
    touched = true
  }
  // npm records the version twice in a lockfile; both must move or `npm ci`
  // and the sync check disagree.
  if (pkg.packages?.['']?.version !== undefined && pkg.packages[''].version !== version) {
    changed.push(`${file} (.packages[""].version): ${pkg.packages[''].version} -> ${version}`)
    pkg.packages[''].version = version
    touched = true
  }

  if (touched) writeJson(file, pkg)
}

if (changed.length === 0) {
  console.log(`Already at ${version} — nothing to write.`)
  process.exit(0)
}

console.log(`Set version ${version}:`)
for (const line of changed) console.log(`  ${line}`)
