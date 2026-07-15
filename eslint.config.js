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
      // Снижаем строгость типизации и стиля, чтобы не мешало жить
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { "argsIgnorePattern": "^_" }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'prefer-const': 'warn',
      'no-empty': 'warn',
      'no-useless-escape': 'warn',
      
      'no-console': 'off',
      'vue/multi-word-component-names': 'off',

      // Vue 3 - Строгие правила (ОСТАВЛЯЕМ КАК ERROR, это ловит реальные баги)
      'vue/no-mutating-props': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      'vue/no-ref-as-operand': 'error',
      'vue/return-in-computed-property': 'error',
      'vue/no-side-effects-in-computed-properties': 'error',
      'vue/valid-v-for': 'error',
      'vue/require-v-for-key': 'error',
      'vue/no-use-v-if-with-v-for': 'error',
      'vue/define-props-declaration': 'off'
    }
  }
);
