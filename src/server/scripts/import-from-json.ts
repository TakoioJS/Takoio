import { readFileSync, existsSync } from 'node:fs'
import { ensureDb, importStore } from '../core/store/index'

const STORE_PATH = process.env.STORE_PATH || './data/store.json'

async function main () {
  if (!existsSync(STORE_PATH)) {
    console.info('No store.json found, nothing to import')
    return
  }

  await ensureDb()

  const raw = readFileSync(STORE_PATH, 'utf-8')
  const data = JSON.parse(raw)
  const commentsBefore = data.comments?.length || 0
  const configsBefore = Object.keys(data.configs || {}).length
  const visitorsBefore = Object.keys(data.visitors || {}).length

  await importStore(data)

  console.info({
    comments: commentsBefore,
    configs: configsBefore,
    visitors: visitorsBefore,
    source: STORE_PATH,
  }, 'Imported data from store.json to SQLite')
}

main().catch(err => {
  console.error({ error: err.message }, 'Import failed')
  process.exit(1)
})
