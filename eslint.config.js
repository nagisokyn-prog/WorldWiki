import js from '@eslint/js';
import globals from 'globals';
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
      '**/vendor/**',
      '**/target/**',
      '**/coverage/**',
      '**/tauri-surreal-kit/**',
      '**/test/mocks/**',
      '**/generated/**',
      '**/*.d.ts',
      'src/ts/libs/**',
      'src/ts/toastui/**',
      '**/*.cjs',
      '**/*.js',
      '**/*.mjs'
    ]
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: vue.parser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.vue']
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // Снижаем строгость типизации и стиля, чтобы не мешало жить
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { "argsIgnorePattern": "^_" }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      'prefer-const': 'error',
      'no-empty': 'error',
      'no-useless-escape': 'error',
      
      'no-console': 'off',
      'vue/multi-word-component-names': ['error', { ignores: ['Splash', 'Settings'] }],

      // Vue 3 - Строгие правила (ОСТАВЛЯЕМ КАК ERROR, это ловит реальные баги)
      'vue/no-mutating-props': 'error',
      '@typescript-eslint/no-unused-expressions': 'error',
      'vue/no-ref-as-operand': 'error',
      'vue/return-in-computed-property': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/valid-v-for': 'error',
      'vue/require-v-for-key': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/define-props-declaration': 'error',
      'vue/no-v-html': 'error'
    }
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'vue/one-component-per-file': 'off',
      'vue/require-prop-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  }
);
