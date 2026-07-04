import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const targetDir = process.argv[2]

if (!targetDir) {
  console.error('Usage: node scripts/copy-xdb.mjs <target-dir>')
  process.exit(1)
}

const source = join(__dirname, '../node_modules/ip2region-ts/data/ip2region.xdb')
const dest = join(targetDir, 'ip2region.xdb')

if (!existsSync(source)) {
  console.error(`ip2region.xdb not found at ${source}`)
  process.exit(1)
}

mkdirSync(targetDir, { recursive: true })
copyFileSync(source, dest)
console.log(`Copied ip2region.xdb -> ${dest}`)
