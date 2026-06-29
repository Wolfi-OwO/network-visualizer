import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Same TypeScript-ESLint base as the client (js + typescript-eslint recommended),
// without the React plugins and with Node globals instead of browser ones.
export default defineConfig([
  globalIgnores(['dist', 'client', 'coverage']),
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Intentionally-unused params/vars follow the `_` convention (Express
      // handlers, Mongoose transforms, etc.).
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // Test files use Mocha's globals (describe/it/before/after).
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.mocha },
    },
  },
])
