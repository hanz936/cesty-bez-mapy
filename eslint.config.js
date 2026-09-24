import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  {
    // Deno svět má vlastní `deno check`/`check:edge`; bez ignore by TS blok
    // spadl na souborech mimo tsconfig projekt. Generovaný database.types.ts
    // padá na stylistic pravidlech (consistent-type-definitions aj. — empiricky
    // 6 errorů) — artefakt se nelintuje, canonical kopii kryje ignore functions.
    // `.superpowers` a `.worktrees` jsou mimo git (pracovní poznámky agentů a další
    // pracovní stromy repa), jenže flat config `.gitignore` nečte — bez ignore by lint
    // procházel i je, z hlavního checkoutu třeba celý rozdělaný worktree.
    ignores: ['dist', 'supabase/functions/**', 'src/types/database.types.ts', '.superpowers', '.worktrees'],
  },
  // JS/JSX a build skripty (.mjs, .cjs). `files` rozhoduje, kdo pravidla dostane:
  // ESLint sice `.mjs` a `.cjs` lintuje sám od sebe, ale bez shody tady by prošly
  // bez jediného pravidla. Doporučená sada jde přes `extends` — dřív byla rozbalená
  // do objektu a vlastní `rules` níž ji celou přepsaly (JS soubory měly 4 pravidla).
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    extends: [js.configs.recommended],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node, // Pro process.env
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^_' }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // TS/TSX — typed linting (typescript-eslint docs: recommendedTypeChecked
  // + stylisticTypeChecked pro „most projects“; stylistic vynucuje
  // consistent-type-definitions → interface)
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Testy — globals (describe/it/expect); pro TS testy typy řeší vitest/globals v tsconfig.test.json
  {
    files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest, // Pro describe, it, expect
      },
    },
  },
)
