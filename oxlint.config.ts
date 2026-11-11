/** Oxlint rules for type safety, readability, and source size limits. */
import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'unicorn', 'oxc'],
  categories: {
    correctness: 'error',
    suspicious: 'error',
  },
  options: {
    typeAware: true,
  },
  ignorePatterns: [
    'epub.js/**',
    'logs/**',
    'scripts/**',
    'node_modules/**',
    'dist/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ],
  rules: {
    'max-lines': ['error', { max: 300 }],
    'max-lines-per-function': ['error', { max: 50, skipComments: true }],
    'no-nested-ternary': 'error',
    curly: ['error', 'all'],
    eqeqeq: ['error', 'always'],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      rules: {
        'typescript/consistent-type-imports': 'error',
        'typescript/explicit-module-boundary-types': 'error',
        'typescript/no-explicit-any': 'error',
        'typescript/no-non-null-assertion': 'error',
        'typescript/await-thenable': 'error',
        'typescript/no-floating-promises': 'error',
        'typescript/no-misused-promises': 'error',
        'typescript/no-unsafe-assignment': 'error',
        'typescript/no-unsafe-argument': 'error',
        'typescript/no-unsafe-call': 'error',
        'typescript/no-unsafe-member-access': 'error',
        'typescript/no-unsafe-return': 'error',
        'typescript/no-unnecessary-type-assertion': 'error',
      },
    },
  ],
});
