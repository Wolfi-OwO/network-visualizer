#!/usr/bin/env node
// Guards against the failure this repo actually hit: the git tag said v2.3.0
// while application/package.json still said 1.0.0 and the client said 0.0.0,
// because nothing ever wrote them. It was invisible from the outside, because the
// build injects the displayed version from the *tag* — the worst kind of bug.
//
// Publishing a release now writes every one of these files from the tag you
// released (scripts/set-version.mjs, run by .github/workflows/release.yml), and the
// tag is moved onto that commit — so they agree by construction. This script is the
// seatbelt: it fails CI if a hand-edit or a bad merge lets them drift apart again.
//
// version.txt is the source of truth: it is the plain-text mirror of the released
// version, and the release pipeline re-checks it against the tag itself.
//
//   node scripts/check-version-sync.mjs

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const json = (p) => JSON.parse(read(p))

const SOURCE_OF_TRUTH = 'version.txt'
const expected = read(SOURCE_OF_TRUTH).trim()

if (!expected) {
  console.error(`error: ${SOURCE_OF_TRUTH} is empty — cannot determine the expected version.`)
  process.exit(1)
}
if (!/^\d+\.\d+\.\d+/.test(expected)) {
  console.error(`error: ${SOURCE_OF_TRUTH} version "${expected}" is not semver.`)
  process.exit(1)
}

// Every other place the version is recorded, and how to pull it back out.
const targets = [
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
    '\nDo not fix this by hand-editing one file. Set them all at once:' +
      `\n\n  node scripts/set-version.mjs ${expected}\n` +
      '\n(see docs/releasing.md).',
  )
  process.exit(1)
}

console.log(`All ${targets.length + 1} version files agree with ${SOURCE_OF_TRUTH}: ${expected}`)
