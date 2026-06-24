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
      // DX-only: components co-export their ReactFlow node/edge-type maps & shared types.
      'react-refresh/only-export-components': 'warn',
      // Opinionated React-Compiler-era rules. Our usages (mount-once init, syncing
      // local form state to the selected element, DOM measuring, the recursive
      // setTimeout animation loop) are intentional and correct at runtime.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      // Mirroring current state into refs for the background-simulation interval
      'react-hooks/refs': 'warn',
    },
  },
])
