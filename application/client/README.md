# NetViz — Frontend

React 19 + TypeScript + Vite single-page app: the network builder canvas
(React Flow), Wireshark-style packet capture, CIDR calculator, dashboard,
and the admin console. Talks to the backend at `/api` (and
`/auth` for sign-in) — same origin in production, proxied in development.

## Layout

```text
src/
├─ pages/          # one folder per page incl. its components
│  ├─ dashboard/   ├─ network/    ├─ packets/    ├─ cidr/
│  ├─ admin/       ├─ auth/       └─ error/
├─ components/     # core/ (generic UI) · toasts/
├─ layouts/        # regular-layout, admin-layout, top-nav, sidebar, error-page
├─ lib/api/        # axios client (one module per backend resource; auth uses /auth)
├─ context/        # auth provider, toast provider
├─ hooks/          # use-toast and friends
├─ config/         # frontend config (VITE_* env vars)
├─ styles/         # global CSS
└─ types/          # shared types (mirror of the backend's)
```

Conventions: lowercase kebab-case filenames, explicit import extensions
(`./foo.ts`), so builds behave identically on case-sensitive filesystems.

## Scripts

| Script              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Vite dev server on :5173 with HMR                   |
| `npm run build`     | Type-check (`tsc -b`) + production bundle → `dist/` |
| `npm run preview`   | Preview the production bundle locally               |
| `npm run lint`      | Run ESLint                                          |
| `npm run typecheck` | Type-check without emitting                         |

## Development

The dev server proxies `/api` and `/auth` to the backend on
`http://localhost:8080` (see [`vite.config.ts`](vite.config.ts)) — start the
backend first, then `npm run dev` here and open <http://localhost:5173>.

## Configuration

Only `VITE_*` variables are exposed to the app; they are read in
[`src/config/index.ts`](src/config/index.ts) and documented in
[`.env.example`](.env.example) (app metadata shown in the footer, mirroring the
OCI image annotations). Copy to `.env.local` to override locally —
`VITE_APP_REVISION` is filled from git automatically in dev builds.

## Production build

`npm run build` emits static assets to `dist/`. There is no separate frontend
image: CI uploads `dist/` as the `client-dist` artifact and the backend Docker
image serves it with an SPA fallback. Any static host works too — point it at
the backend origin.
