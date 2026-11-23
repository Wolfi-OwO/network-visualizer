/// <reference types="mocha" />
import { readFileSync } from 'node:fs';
import { assert } from '../common.ts';
import { renderIndex } from '../../src/seo/render.ts';
import { CIDR_FAQ, PAGES } from '../../src/seo/pages.ts';

const template = readFileSync('client/index.html', 'utf8');

describe('seo: renderIndex', () => {
  it('gives /cidr its own title, description, canonical and text', () => {
    const html = renderIndex(template, '/cidr');
    assert.ok(html.includes(`<title>${PAGES['/cidr']!.title}</title>`));
    assert.ok(html.includes('href="https://netviz.woofi-developments.at/cidr"'));
    assert.ok(html.includes('content="https://netviz.woofi-developments.at/cidr"'));
    assert.ok(html.includes('192.168.10.63'));
    assert.ok(html.includes('<h1>CIDR calculator</h1>'));
    assert.equal(html.match(/<title>/g)?.length, 1);
  });

  it('adds a FAQPage with every question, and its JSON parses', () => {
    const html = renderIndex(template, '/cidr');
    const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]!;
    const graph = JSON.parse(json)['@graph'] as { '@type': string; mainEntity?: unknown[] }[];
    const faq = graph.find((g) => g['@type'] === 'FAQPage')!;
    assert.equal(faq.mainEntity!.length, CIDR_FAQ.length);
  });

  it('treats a trailing slash as the same page', () => {
    assert.equal(renderIndex(template, '/cidr/'), renderIndex(template, '/cidr'));
  });

  it('leaves private routes and unknown paths untouched', () => {
    for (const p of ['/login', '/admin', '/account', '/nothing-here'])
      assert.equal(renderIndex(template, p), template);
  });
});
