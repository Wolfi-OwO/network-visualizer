// Build-time Markdown -> HTML for the three legal documents (PRIVACY.md,
// IMPRESSUM.md, TERMS_OF_USE.md).
//
// Why this exists rather than a Markdown library: § 5 ECG requires the legal
// information to be available *on the service*, so the documents must render
// as in-app routes. The markdown files stay the single source of truth, and
// the conversion happens here at build time, so nothing is duplicated into JSX
// and no parser is shipped to the browser.
//
// Deliberately not a general Markdown implementation. It covers exactly the
// constructs those three files use — headings, horizontal rules, paragraphs,
// flat bullet lists, simple tables, bold, inline code and links — and throws
// on anything it does not recognise, so an unsupported construct fails the
// build instead of silently vanishing from a legal page. tooling/markdown.test.js
// asserts that against the real files.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const escapeHtml = (text) => text.replace(/[&<>"]/g, (char) => HTML_ESCAPES[char])

// Cross-references between the documents must resolve to the in-app routes, not
// to the .md files — following one off-origin is the exact problem this fixes.
const INTERNAL_LINKS = {
  'PRIVACY.md': '/privacy',
  'IMPRESSUM.md': '/impressum',
  'TERMS_OF_USE.md': '/terms',
}

function renderLink(label, href) {
  const internal = INTERNAL_LINKS[href]
  if (internal) return `<a href="${internal}">${label}</a>`
  if (href.startsWith('mailto:') || href.startsWith('https://')) {
    return `<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`
  }
  throw new Error(
    `markdown: unsupported link target ${JSON.stringify(href)}. Add it to ` +
      'INTERNAL_LINKS if it points at another legal document.',
  )
}

function renderInline(text) {
  // Code spans are split out first so their contents are not re-parsed as
  // markdown; escaping runs before that, so no backtick can come from the text.
  return escapeHtml(text)
    .split(/(`[^`]+`)/)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? `<code>${part.slice(1, -1)}</code>`
        : part
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_match, label, href) =>
              renderLink(label, href),
            ),
    )
    .join('')
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())

const isSeparatorRow = (line) => splitRow(line).every((cell) => /^:?-+:?$/.test(cell))

export function markdownToHtml(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) {
      i += 1
      continue
    }

    const heading = /^(#{1,6}) (.*)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      i += 1
      continue
    }

    if (/^-{3,}\s*$/.test(line)) {
      out.push('<hr />')
      i += 1
      continue
    }

    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i])
        i += 1
      }
      const body = rows.filter((row) => !isSeparatorRow(row))
      const [header, ...rest] = body
      const cells = (row, tag) =>
        splitRow(row)
          .map((cell) => `<${tag}>${renderInline(cell)}</${tag}>`)
          .join('')
      out.push(
        '<table><thead><tr>' +
          cells(header, 'th') +
          '</tr></thead><tbody>' +
          rest.map((row) => `<tr>${cells(row, 'td')}</tr>`).join('') +
          '</tbody></table>',
      )
      continue
    }

    if (/^[-*] /.test(line)) {
      const items = []
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].slice(2).trim())}</li>`)
        i += 1
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Anything else is a paragraph: consecutive plain lines join into one.
    const paragraph = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6} |-{3,}\s*$|[-*] )/.test(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    out.push(`<p>${renderInline(paragraph.join(' '))}</p>`)
  }

  return out.join('\n')
}

// The legal documents live at the repository root, two levels above this client.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

export const LEGAL_DOCUMENTS = {
  privacy: { file: 'PRIVACY.md', title: 'Privacy Policy' },
  impressum: { file: 'IMPRESSUM.md', title: 'Impressum' },
  terms: { file: 'TERMS_OF_USE.md', title: 'Terms of Use' },
}

export const legalDocumentPath = (slug) => resolve(REPO_ROOT, LEGAL_DOCUMENTS[slug].file)

const VIRTUAL_PREFIX = 'virtual:legal/'

// Exposes each document as `virtual:legal/<slug>`, converted at build time.
// A virtual module keeps the repo-root paths out of the app source, so the
// client needs no `server.fs.allow` escape hatch to read files above its root.
export function legalDocumentsPlugin() {
  return {
    name: 'netviz-legal-documents',
    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return `\0${id}`
      return null
    },
    load(id) {
      if (!id.startsWith(`\0${VIRTUAL_PREFIX}`)) return null
      const slug = id.slice(VIRTUAL_PREFIX.length + 1)
      const doc = LEGAL_DOCUMENTS[slug]
      if (!doc) throw new Error(`markdown: unknown legal document ${slug}`)
      const path = legalDocumentPath(slug)
      this.addWatchFile(path)
      const html = markdownToHtml(readFileSync(path, 'utf8'))
      return `export const title = ${JSON.stringify(doc.title)}\nexport const html = ${JSON.stringify(html)}\n`
    },
  }
}
