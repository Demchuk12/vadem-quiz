// @ts-check
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

// Feature-Sliced Design: a layer imports only from layers below it, and only through a slice's
// public API. Shared has segments instead of slices (`@shared/api`).
const PUBLIC_API = {
  group: ['@shared/*/*', '@entities/*/*', '@features/*/*', '@widgets/*/*', '@pages/*/*'],
  message: "Import from the slice's public API (its index.ts).",
};
const layerRule = (folder, forbidden) => ({
  files: [`src/${folder}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          PUBLIC_API,
          {
            group: forbidden,
            message: 'A layer may import only from layers below it, not from its own or above.',
          },
        ],
      },
    ],
  },
});

module.exports = defineConfig([
  globalIgnores([
    'dist/',
    '.angular/',
    '.tools/',
    'graphify-out/',
    'supabase/',
    'test-results/',
    'playwright-report/',
  ]),
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'vq', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'vq', style: 'kebab-case' },
      ],
    },
  },
  layerRule('shared', ['@shared/*', '@entities/*', '@features/*', '@widgets/*', '@pages/*']),
  layerRule('entities', ['@entities/*', '@features/*', '@widgets/*', '@pages/*']),
  layerRule('features', ['@features/*', '@widgets/*', '@pages/*']),
  layerRule('widgets', ['@widgets/*', '@pages/*']),
  layerRule('pages', ['@pages/*']),
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
]);
