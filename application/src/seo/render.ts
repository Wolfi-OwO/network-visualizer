import { CIDR_FAQ, CIDR_GUIDE, ORIGIN, PAGES, PREFIX_TABLE } from './pages.js';

const escape = (text: string): string =>
  text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );

/** `/cidr/` and `/cidr` are one page. */
const normalise = (pathname: string): string =>
  pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

/** Visually hidden, because the real page replaces it as soon as the app mounts; a crawler reads it as the page text. */
function snapshot(pathname: string): string {
  const page = PAGES[pathname];
  if (!page) return '';
  let html = `<h1>${escape(page.heading)}</h1><p>${escape(page.intro)}</p>`;
  if (pathname === '/cidr') {
    for (const section of CIDR_GUIDE)
      html += `<h2>${escape(section.heading)}</h2>${section.paragraphs.map((p) => `<p>${escape(p)}</p>`).join('')}`;
    html += '<h2>Prefix length, subnet mask and host count</h2><table><tbody>';
    for (const r of PREFIX_TABLE)
      html += `<tr><td>${r.prefix}</td><td>${r.mask}</td><td>${r.addresses}</td><td>${escape(r.usable)}</td></tr>`;
    html += '</tbody></table><h2>Frequently asked questions</h2>';
    for (const f of CIDR_FAQ) html += `<h3>${escape(f.question)}</h3><p>${escape(f.answer)}</p>`;
  }
  return `<div data-prerender style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">${html}</div>`;
}

function jsonLd(pathname: string): string {
  const page = PAGES[pathname];
  if (!page) return '';
  const graph: object[] = [
    {
      '@type': 'WebApplication',
      name: pathname === '/cidr' ? 'NetViz CIDR Calculator' : 'NetViz',
      url: `${ORIGIN}${pathname === '/' ? '/' : pathname}`,
      description: page.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any (runs in the browser)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ];
  if (pathname === '/cidr')
    graph.push({
      '@type': 'FAQPage',
      mainEntity: CIDR_FAQ.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    });
  // "<" is escaped so no text in the data can close the script element.
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c',
  );
  return `<script type="application/ld+json">${json}</script>`;
}

/**
 * Fills the title, description, canonical and share tags of the built index.html for one route and puts that route's
 * text into the empty root. Any route without an entry (sign-in, admin, 404s) gets the file unchanged.
 */
export function renderIndex(template: string, rawPath: string): string {
  const pathname = normalise(rawPath);
  const page = PAGES[pathname];
  if (!page) return template;
  const url = `${ORIGIN}${pathname}`;
  const title = escape(page.title);
  const description = escape(page.description);
  return template
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      (_m, a: string, b: string) => `${a}${description}${b}`,
    )
    .replace(
      /(<link\s+rel="canonical"\s+href=")[^"]*(")/,
      (_m, a: string, b: string) => `${a}${url}${b}`,
    )
    .replace(
      /(<meta\s+property="og:title"\s+content=")[^"]*(")/,
      (_m, a: string, b: string) => `${a}${title}${b}`,
    )
    .replace(
      /(<meta\s+property="og:description"\s+content=")[^"]*(")/,
      (_m, a: string, b: string) => `${a}${description}${b}`,
    )
    .replace(
      /(<meta\s+property="og:url"\s+content=")[^"]*(")/,
      (_m, a: string, b: string) => `${a}${url}${b}`,
    )
    .replace('</head>', () => `${jsonLd(pathname)}</head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${snapshot(pathname)}</div>`);
}
