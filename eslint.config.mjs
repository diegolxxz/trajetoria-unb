import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.venv/**', '.playwright-mcp/**'] },
  js.configs.recommended,
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, AppUnB: 'readonly', CalculosUnB: 'readonly' },
    },
  },
  {
    files: ['public/js/functionality.js'],
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^(adicionarDisciplina|removerDisciplina)$' }] },
  },
  { files: ['public/js/calculos.js'], languageOptions: { globals: { module: 'readonly', CalculosUnB: 'off' } } },
  {
    files: ['public/js/common.js'],
    languageOptions: { globals: { AppUnB: 'off' } },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^AppUnB$' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['public/js/cursos.js'], rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^CURSOS$' }] } },
  { files: ['**/*.mjs', 'tests/**/*.cjs'], languageOptions: { globals: globals.node } },
];
