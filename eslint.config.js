import neostandard from 'neostandard'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

export default [
  ...neostandard(),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      '@stylistic/no-multi-spaces': 'off',
      '@stylistic/quote-props': 'off'
    }
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'docs/**',
      '*.config.js',
      '*.config.ts'
    ]
  }
]
