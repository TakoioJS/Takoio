/// <reference types="vite/client" />

interface Window {
  TAKOIO_MAGIC_PATH?: string
  TAKOIO_MAGIC_HREF?: string
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

declare module 'virtual:uno.css' {
  const content: string
  export default content
}

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
