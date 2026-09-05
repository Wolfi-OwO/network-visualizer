// Self-check for the build-time Markdown converter.
// Run: node tooling/markdown.test.js
//
// The point is the second half: it converts the three REAL legal documents and
// asserts nothing was dropped. A legal page silently losing a clause is the
// failure mode worth catching, so the counts are compared against the sources.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LEGAL_DOCUMENTS, legalDocumentPath, markdownToHtml } from './markdown.js'

// --- Construct-level checks -------------------------------------------------

assert.equal(markdownToHtml('# Title'), '<h1>Title</h1>')
assert.equal(markdownToHtml('#### Deep'), '<h4>Deep</h4>')
assert.equal(markdownToHtml('---'), '<hr />')
assert.equal(markdownToHtml('Plain text.'), '<p>Plain text.</p>')
assert.equal(markdownToHtml('One\nline.'), '<p>One line.</p>', 'wrapped lines join')
assert.equal(markdownToHtml('- a\n- b'), '<ul><li>a</li><li>b</li></ul>')
assert.equal(markdownToHtml('**bold**'), '<p><strong>bold</strong></p>')
assert.equal(markdownToHtml('`code`'), '<p><code>code</code></p>')

// Escaping: text must never become markup.
assert.equal(markdownToHtml('<script>x</script>'), '<p>&lt;script&gt;x&lt;/script&gt;</p>')
assert.equal(markdownToHtml('a & b'), '<p>a &amp; b</p>')

// Markdown inside a code span stays literal.
assert.equal(markdownToHtml('`**not bold**`'), '<p><code>**not bold**</code></p>')

// Links: cross-document references resolve in-app, mail/https open out.
assert.equal(markdownToHtml('[p](PRIVACY.md)'), '<p><a href="/privacy">p</a></p>')
assert.equal(markdownToHtml('[t](TERMS_OF_USE.md)'), '<p><a href="/terms">t</a></p>')
assert.match(markdownToHtml('[m](mailto:a@b.c)'), /href="mailto:a@b\.c"/)
assert.throws(
  () => markdownToHtml('[x](javascript:alert(1))'),
  /unsupported link target/,
  'unknown link targets must fail the build, not render dead or dangerous',
)

// Tables: the separator row is dropped, the first row becomes the header.
assert.equal(
  markdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |'),
  '<table><thead><tr><th>A</th><th>B</th></tr></thead>' +
    '<tbody><tr><td>1</td><td>2</td></tr></tbody></table>',
)

// --- The real documents -----------------------------------------------------

for (const [slug, doc] of Object.entries(LEGAL_DOCUMENTS)) {
  const source = readFileSync(legalDocumentPath(slug), 'utf8')
  const html = markdownToHtml(source)

  const countSource = (re) => (source.match(re) || []).length
  const countHtml = (re) => (html.match(re) || []).length

  assert.equal(
    countHtml(/<h[1-6]>/g),
    countSource(/^#{1,6} /gm),
    `${doc.file}: every heading must survive conversion`,
  )
  assert.equal(
    countHtml(/<li>/g),
    countSource(/^[-*] /gm),
    `${doc.file}: every bullet must survive conversion`,
  )
  assert.equal(
    countHtml(/<a /g),
    countSource(/\[[^\]]*\]\([^)]*\)/g),
    `${doc.file}: every link must survive conversion`,
  )
  assert.ok(html.includes('<h1>'), `${doc.file}: needs a title heading`)
  assert.ok(!html.includes('](') , `${doc.file}: no unconverted link syntax`)
  assert.ok(!/\*\*/.test(html), `${doc.file}: no unconverted bold syntax`)

  // Nothing may still point at the markdown files once rendered in-app.
  assert.ok(
    !/href="[^"]*\.md"/.test(html),
    `${doc.file}: cross-references must resolve to in-app routes`,
  )
  console.log(`  ok  ${doc.file} -> ${html.length} bytes of HTML`)
}

console.log('markdown self-check passed')
