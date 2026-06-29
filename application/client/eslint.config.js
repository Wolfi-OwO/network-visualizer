import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // DX-only fast-refresh hint. We intentionally co-export ReactFlow node/edge
      // -type maps and shared types next to their components, so this is off.
      'react-refresh/only-export-components': 'off',
      // React-Compiler-oriented rules (eslint-plugin-react-hooks v7). They flag
      // patterns that are deliberate and correct in standard (non-Compiler) React
      // in this app — loading data in an on-mount effect, mirroring the latest
      // state into refs for the requestAnimationFrame simulation loop, and the
      // rAF engine's in-place particle mutation. We don't run the React Compiler,
      // so these are turned off rather than worked around.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      // Kept ON (the classic, valuable rule) — real missing deps are fixed in code.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
])
