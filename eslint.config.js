import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

// Layer boundaries enforced by lint. See docs/data_boundaries.md. The web app's
// display layer reads through @scrolled/game-db; only the extraction layer
// (workers/, hooks/extraction/, parser/, components/wizard/) may import the
// write path (extractor).
const BOUNDARY_SEVERITY = 'error';

const noExtractorInDisplay = {
  group: ['@scrolled/extractor', '@scrolled/extractor/*'],
  message:
    'Display/read code must go through @scrolled/game-db, not the extractor (write path). See docs/data_boundaries.md.',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },

  // The web app's display layer reads through @scrolled/game-db only. The write
  // path (extractor) is reachable from the extraction layer alone — workers/,
  // hooks/extraction/, parser/, and components/wizard/ — which are NOT covered
  // by the globs below.
  //
  // Exception: extractorCatalog.ts is the one display file that needs the
  // extractor's canonical key vocabulary (label + icon per extraction category).
  // It can't live in the extractor (it imports lucide icons), so it imports the
  // key list from there. That's a type/const import, not extraction logic.
  {
    files: [
      'apps/web/src/components/**/*.{ts,tsx}',
      'apps/web/src/routes/**/*.{ts,tsx}',
      'apps/web/src/lib/**/*.{ts,tsx}',
      'apps/web/src/search/**/*.{ts,tsx}',
    ],
    ignores: [
      'apps/web/src/components/wizard/**',
      'apps/web/src/components/common/extractorCatalog.ts',
    ],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        { patterns: [noExtractorInDisplay] },
      ],
    },
  },

  // game-db is read+storage; it must not depend on the write path.
  {
    files: ['packages/game-db/**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        {
          patterns: [
            {
              group: [
                '@scrolled/extractor',
                '@scrolled/extractor/*',
                '@scrolled/wz',
                '@scrolled/wz/*',
              ],
              message:
                'game-db is the read/storage contract — it must not import the write path (extractor/wz). See docs/data_boundaries.md.',
            },
          ],
        },
      ],
    },
  },

  // dataset-core is a leaf: only third-party deps, no @scrolled/* imports.
  {
    files: ['packages/dataset-core/**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        {
          patterns: [
            {
              group: ['@scrolled/*'],
              message:
                'dataset-core is a leaf package — it must not import other @scrolled/* packages. See docs/data_boundaries.md.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
