/// <reference types="vite/client" />

declare const __TAKOIO_VERSION__: string

interface Window {
  TAKOIO_MAGIC_PATH?: string
  TAKOIO_MAGIC_HREF?: string
  /** UMD 全局入口 */
  takoio: {
    init: (options: import('./src/client/types').TakoioConfig) => Promise<void>
    getCommentsCount: (options: { envId: string; urls: string[]; funcName?: string }) => Promise<Array<{ url: string; count: number }>>
    getRecentComments: (options: { envId: string; funcName?: string; count?: number; includeReply?: boolean }) => Promise<any[]>
    getVisitorsCount: (options: { envId: string; funcName?: string; url?: string; href?: string; title?: string }) => Promise<{ time: number } | null>
    version: string
  }
}

interface Navigator {
  userAgentData?: {
    platform: string
    getHighEntropyValues: (hints: string[]) => Promise<{ platformVersion: string }>
  }
}

interface ImportMeta {
  readonly env: {
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly SSR: boolean
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'virtual:uno.css' {}

declare module 'sql.js' {
  const initSqlJs: () => Promise<{
    Database: new (data?: ArrayLike<number> | Buffer) => {
      run: (sql: string) => void
      export: () => Uint8Array
      close: () => void
    }
  }>
  export default initSqlJs
}
