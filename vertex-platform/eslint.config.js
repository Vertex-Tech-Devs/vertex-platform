const angularPlugin = require('@angular-eslint/eslint-plugin');
const angularTemplatePlugin = require('@angular-eslint/eslint-plugin-template');
const angularTemplateParser = require('@angular-eslint/template-parser');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');

module.exports = [
  {
    ignores: ['dist/**/*', 'coverage/**/*', 'node_modules/**/*', '.angular/**/*', 'functions/vitest.config.ts', 'functions/lib/**/*', 'functions/coverage/**/*'],
  },
  // Application source — Angular + TypeScript strict rules
  {
    files: ['src/**/*.ts'],
    ignores: ['src/**/*.spec.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['tsconfig.app.json'],
      },
    },
    plugins: {
      '@angular-eslint': angularPlugin,
      '@typescript-eslint': typescriptEslintPlugin,
    },
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'no-public' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: 'error',
      'brace-style': ['error', '1tbs'],
      'quote-props': ['error', 'as-needed'],
      'object-shorthand': ['error', 'always'],
      'no-unneeded-ternary': 'error',
      'max-classes-per-file': ['error', 1],
      'max-lines': ['warn', { max: 900 }],
      complexity: ['warn', { max: 60 }],
    },
  },
  // Test files — relaxed rules, separate tsconfig
  {
    files: ['src/**/*.spec.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['tsconfig.spec.json'],
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-debugger': 'error',
      'prefer-const': 'error',
    },
  },
  // Templates
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser,
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin,
    },
    rules: {
      '@angular-eslint/template/no-negated-async': 'error',
    },
  },
  // Cloud Functions source code
  {
    files: ['functions/src/**/*.ts', 'functions/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: ['functions/tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-debugger': 'error',
      'prefer-const': 'off',
    },
  },
];
