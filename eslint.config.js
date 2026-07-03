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
  send: 'readonly',
  sendRedirect: 'readonly',
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
  // Phase 1 防护栏：core/ 层禁止 import h3/nitropack/nitro（Phase 2 已转 error 级）
  // 覆盖从 h3 命名导入 getRequestIP/getRequestHeader/H3Event/getQuery/setResponseHeader/sendStream 等
  {
    files: ['src/server/core/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'h3',
            message: 'core/ 层必须框架无关；h3 依赖（getRequestIP/getRequestHeader/H3Event/getQuery/setResponseHeader/sendStream 等）需通过 RequestContext/SSESink 端口接口由 nitro 层注入'
          },
          {
            name: 'nitropack',
            message: 'core/ 层必须框架无关；禁止依赖 nitropack'
          },
          {
            name: 'nitro',
            message: 'core/ 层必须框架无关；禁止依赖 nitro'
          }
        ]
      }]
    }
  },
  // Phase 1 防护栏：nitro/ 层禁止 #core/(handlers|store|utils|db|schemas) 深层 import（Phase 5 已转 error 级）
  {
    files: ['src/server/nitro/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '#core/(handlers|store|utils|db|schemas)(/.*)?',
            message: 'nitro/ 层应仅通过 #core 单一 facade import；禁止深层 import core 子模块'
          }
        ]
      }]
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
