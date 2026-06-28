import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.LIBSQL_URL || process.env.TURSO_DB_URL || 'file:./data/takoio.db',
  },
})
