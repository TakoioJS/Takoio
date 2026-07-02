import { readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const DIST_DIR = join(import.meta.dirname, '..', 'dist')
const BUDGETS = [
  { file: 'takoio.umd.cjs',   budget: 90_000, label: 'UMD (gzip)' },
  { file: 'takoio.esm.js',    budget: 80_000, label: 'ESM (gzip)' },
  { file: 'takoio.css',       budget: 15_000, label: 'CSS (gzip)' },
]

let failed = false

for (const { file, budget, label } of BUDGETS) {
  const path = join(DIST_DIR, file)
  if (!existsSync(path)) {
    console.warn(`[size-check] SKIP: ${file} — 文件不存在，请先运行 pnpm build`)
    continue
  }
  const content = readFileSync(path)
  const gzipSize = gzipSync(content).length
  const status = gzipSize <= budget ? 'PASS' : 'FAIL'
  const pct = ((gzipSize / budget) * 100).toFixed(1)
  console.log(`[size-check] ${status}  ${file.padEnd(24)} ${String(gzipSize).padStart(6)} B  (预算 ${(budget / 1000).toFixed(0)} KB, ${pct}%)`)
  if (gzipSize > budget) failed = true
}

process.exit(failed ? 1 : 0)
