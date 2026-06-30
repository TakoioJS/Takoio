import globals from 'globals'
import neostandard from 'neostandard'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import tsParser from '@typescript-eslint/parser'

const GLOBALS = {
  ...globals.browser,
  ...globals.node,
  ...globals.es2025,
  ...globals.typescript,
  RequestInit: 'readonly',
  useAuthStore: 'readonly',
  useAppStore: 'readonly',
  useRoute: 'readonly',
  useRouter: 'readonly',
  defineHandler: 'readonly',
  validateBody: 'readonly',
  validateQuery: 'readonly',
  getToken: 'readonly',
  readBody: 'readonly',
  getQuery: 'readonly',
  createError: 'readonly',
  defineMiddleware: 'readonly',
  getRequestURL: 'readonly',
  getRequestHeader: 'readonly',
  setResponseHeader: 'readonly',
  setResponseStatus: 'readonly',
  definePlugin: 'readonly',
  defineErrorHandler: 'readonly',
}

export default [
  ...neostandard(),
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.vue', '**/*.ts'],
    languageOptions: {
      ...(vue.configs['flat/recommended'][0]?.languageOptions || {}),
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: GLOBALS,
    },
    rules: {
      'vue/multi-word-component-names': ['error', { ignores: ['Settings', 'Dashboard', 'Login', 'Ai', 'Summary', 'List', 'Data'] }],
    }
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: GLOBALS,
    },
    rules: {
      '@stylistic/no-multi-spaces': 'off',
      '@stylistic/quote-props': 'off',
      'promise/param-names': 'off',
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
