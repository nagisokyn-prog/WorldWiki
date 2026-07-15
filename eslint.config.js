import js from '@eslint/js';
import ts from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'src/ts/libs/**',
      'src/ts/toastui/**'
    ]
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 2025,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.vue']
      },
      globals: {
        browser: true,
        node: true,
        window: true,
        document: true,
        localStorage: true,
        fetch: true,
        console: true
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { "argsIgnorePattern": "^_" }],
      'no-console': 'off',
      'vue/multi-word-component-names': 'off'
    }
  }
);
