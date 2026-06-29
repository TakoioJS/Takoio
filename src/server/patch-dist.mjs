import { readFileSync, writeFileSync } from 'node:fs'

const target = '../../dist/server/core/store/index.js'
const source = readFileSync(target, 'utf8')
const patched = source
  .replace(/import\('\.\/mongodb'\)/g, "import('./mongodb.js')")
  .replace(/import\('\.\/sqlite'\)/g, "import('./sqlite.js')")

writeFileSync(target, patched)
