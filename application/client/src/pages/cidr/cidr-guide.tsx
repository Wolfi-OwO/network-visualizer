import { CIDR_FAQ, CIDR_GUIDE, PAGES, PREFIX_TABLE } from '../../../../src/seo/pages.ts'

// The same words the server puts into the page before any script runs (src/seo/render.ts), so what a search engine
// indexes is what a visitor reads here.
export function CidrGuide() {
  return (
    <article className="card p-4 space-y-4 text-sm text-[var(--text-secondary)] leading-relaxed">
      <header>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          {PAGES['/cidr']!.heading}
        </h1>
        <p className="mt-1">{PAGES['/cidr']!.intro}</p>
      </header>
      {CIDR_GUIDE.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{section.heading}</h2>
          {section.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
      ))}
      <section className="space-y-2">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Prefix length, subnet mask and host count
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-[var(--text-muted)]">
              <tr>
                <th className="py-1 pr-4 font-medium">Prefix</th>
                <th className="py-1 pr-4 font-medium">Subnet mask</th>
                <th className="py-1 pr-4 font-medium">Addresses</th>
                <th className="py-1 font-medium">Usable hosts</th>
              </tr>
            </thead>
            <tbody>
              {PREFIX_TABLE.map((r) => (
                <tr key={r.prefix} className="border-t border-[var(--border)]">
                  <td className="py-1 pr-4 text-[var(--accent)]">{r.prefix}</td>
                  <td className="py-1 pr-4">{r.mask}</td>
                  <td className="py-1 pr-4">{r.addresses}</td>
                  <td className="py-1">{r.usable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">
          Frequently asked questions
        </h2>
        {CIDR_FAQ.map((f) => (
          <div key={f.question}>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{f.question}</h3>
            <p>{f.answer}</p>
          </div>
        ))}
      </section>
    </article>
  )
}
