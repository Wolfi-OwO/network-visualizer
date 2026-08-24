/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_COMPANY?: string
  readonly VITE_REPO_LABEL?: string
  readonly VITE_REPO_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// The legal documents (PRIVACY.md, IMPRESSUM.md, TERMS_OF_USE.md) are converted
// to HTML at build time and exposed as virtual modules — see build/markdown.js.
declare module 'virtual:legal/*' {
  export const title: string
  export const html: string
}
