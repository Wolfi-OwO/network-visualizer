// Renders one legal document. The HTML comes from the repo-root markdown file,
// converted at build time (tooling/markdown.js), so the .md files stay the single
// source of truth and none of this text is duplicated into JSX.
//
// dangerouslySetInnerHTML is safe here: the markup is produced from our own
// committed markdown during the build, never from user input or a request, and
// the converter escapes the document text before emitting any tags.
export default function LegalPage({ title, html }: { title: string; html: string }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <article
        className="legal-document mx-auto max-w-3xl px-6 py-10"
        aria-label={title}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
