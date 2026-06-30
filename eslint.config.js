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

// Core/display code is identity-AWARE (consumes @scrolled/identity-core) but never
// auth-provider-AWARE. The concrete cloud provider and the auth SDK are reached
// only from the bootstrap shim apps/web/src/identity/, via a dynamic import, so
// self-hosted builds never bundle them. See docs/data_boundaries.md.
const noCloudIdentityInCore = {
  group: [
    '@scrolled/identity-cloud',
    '@scrolled/identity-cloud/*',
    '@supabase/supabase-js',
    '@supabase/*',
  ],
  message:
    'Core/display code is identity-aware, not auth-provider-aware. Consume @scrolled/identity-core only; the cloud provider is reached via apps/web/src/identity/. See docs/data_boundaries.md.',
};

// The same shape for sync: core/display code is sync-AWARE (consumes
// @scrolled/sync-core) but never sync-PROVIDER-aware. The concrete Supabase sync
// transport and its SDK are reached only from the bootstrap shim
// apps/web/src/sync/, via a dynamic import, so self-hosted builds never bundle
// them. See docs/data_boundaries.md §5.
const noCloudSyncInCore = {
  group: [
    '@scrolled/sync-supabase',
    '@scrolled/sync-supabase/*',
    '@supabase/supabase-js',
    '@supabase/*',
  ],
  message:
    'Core/display code is sync-aware, not sync-provider-aware. Consume @scrolled/sync-core only; the Supabase sync transport is reached via apps/web/src/sync/. See docs/data_boundaries.md.',
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
      // The sanctioned bootstrap shims that may reach a cloud provider, and only
      // via a dynamic import() so they are excluded from self-hosted bundles.
      'apps/web/src/identity/**',
      'apps/web/src/sync/**',
    ],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        { patterns: [noExtractorInDisplay, noCloudIdentityInCore, noCloudSyncInCore] },
      ],
    },
  },

  // identity-core is the provider-agnostic contract: it must not know about any
  // concrete provider or auth SDK.
  {
    files: ['packages/identity-core/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        { patterns: [noCloudIdentityInCore] },
      ],
    },
  },

  // sync-core is the provider-agnostic sync contract: it must not know about the
  // concrete Supabase sync transport or its SDK.
  {
    files: ['packages/sync-core/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        { patterns: [noCloudSyncInCore] },
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

  // nav-graph is a leaf: framework-agnostic graph core, only third-party deps.
  // It must not pull in SQLite, React, or extractor/wz. See
  // docs/navigator_implementation.md §2.
  {
    files: ['packages/nav-graph/**/*.ts'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        {
          patterns: [
            {
              group: ['@scrolled/*'],
              message:
                'nav-graph is a leaf package — it must not import other @scrolled/* packages. See docs/navigator_implementation.md §2.',
            },
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*'],
              message:
                'nav-graph must remain framework-agnostic and Node-runnable. See docs/navigator_implementation.md §5.',
            },
          ],
        },
      ],
    },
  },

  // @scrolled/ui is the shared design system: React-aware, but a leaf among
  // @scrolled/* — it must not depend on game-db, the extractor, identity, or any
  // other workspace package. Keeps both apps able to consume it without
  // dragging in app-specific machinery. See docs/navigator_implementation.md §7.
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        BOUNDARY_SEVERITY,
        {
          patterns: [
            {
              group: ['@scrolled/*'],
              message:
                '@scrolled/ui is a leaf design-system package — it must not import other @scrolled/* packages. See docs/navigator_implementation.md §7.',
            },
          ],
        },
      ],
    },
  },

  prettier,
);
