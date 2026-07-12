#!/usr/bin/env node
// Guards against the failure this repo actually hit: the git tag said v2.3.0
// while application/package.json still said 1.0.0 and the client said 0.0.0,
// because nothing ever wrote them.
//
// release-please now bumps every one of these files in the same commit that
// cuts the tag (see release-please-config.json -> "extra-files"), so they agree
// by construction. This script is the seatbelt: it fails CI if a hand-edit, a
// bad merge, or a mistyped extra-files path lets them drift apart again.
//
// The manifest is the source of truth — it is what release-please reads to
// decide the next version, and what the tag is derived from.
//
//   node scripts/check-version-sync.mjs

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const json = (p) => JSON.parse(read(p))

const SOURCE_OF_TRUTH = '.release-please-manifest.json'
const expected = json(SOURCE_OF_TRUTH)['.']

if (!expected) {
  console.error(`error: ${SOURCE_OF_TRUTH} has no "." entry — cannot determine the expected version.`)
  process.exit(1)
}
if (!/^\d+\.\d+\.\d+/.test(expected)) {
  console.error(`error: ${SOURCE_OF_TRUTH} version "${expected}" is not semver.`)
  process.exit(1)
}

// Every place the version is recorded, and how to pull it back out.
const targets = [
  ['version.txt', () => read('version.txt').trim()],
  ['application/package.json', () => json('application/package.json').version],
  ['application/package-lock.json', () => json('application/package-lock.json').version],
  ['application/package-lock.json (packages."")', () => json('application/package-lock.json').packages['']?.version],
  ['application/client/package.json', () => json('application/client/package.json').version],
  ['application/client/package-lock.json', () => json('application/client/package-lock.json').version],
  ['application/client/package-lock.json (packages."")', () => json('application/client/package-lock.json').packages['']?.version],
]

const drifted = []
for (const [label, get] of targets) {
  let actual
  try {
    actual = get()
  } catch (err) {
    drifted.push({ label, actual: `<unreadable: ${err.message}>` })
    continue
  }
  if (actual !== expected) drifted.push({ label, actual: actual ?? '<missing>' })
}

if (drifted.length > 0) {
  console.error(`Version drift — ${SOURCE_OF_TRUTH} says ${expected}, but:\n`)
  for (const { label, actual } of drifted) {
    console.error(`  ${label}\n    expected ${expected}, found ${actual}`)
  }
  console.error(
    '\nDo not fix this by hand-editing one file. Versions are written by release-please;' +
      '\nif they have drifted, set them all to the manifest version in a single commit' +
      '\n(see docs/releasing.md).',
  )
  process.exit(1)
}

console.log(`All ${targets.length} version files agree with ${SOURCE_OF_TRUTH}: ${expected}`)
