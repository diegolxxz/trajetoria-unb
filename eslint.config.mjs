import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '.venv/**', '.playwright-mcp/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, AppUnB: 'readonly', CalculosUnB: 'readonly' },
    },
  },
  {
    files: ['js/functionality.js'],
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^(adicionarDisciplina|removerDisciplina)$' }] },
  },
  { files: ['js/calculos.js'], languageOptions: { globals: { module: 'readonly', CalculosUnB: 'off' } } },
  {
    files: ['js/common.js'],
    languageOptions: { globals: { AppUnB: 'off' } },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^AppUnB$' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['js/cursos.js'], rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^CURSOS$' }] } },
  { files: ['**/*.mjs', 'tests/**/*.cjs'], languageOptions: { globals: globals.node } },
];
