import 'dotenv/config'
import {defineConfig} from 'drizzle-kit'

/**
 * drizzle-kit configuration. Used by:
 *   pnpm db:generate  → emits SQL into ./migrations
 *   pnpm db:studio    → opens the Drizzle Studio UI
 *
 * The runtime migration runner (src/db/migrate.ts) reads this config too.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:54322/postgres',
  },
  // We commit the generated SQL alongside the schema diff. Per CLAUDE.md §10:
  // "Never edit a committed migration. Always add a new one."
  verbose: true,
  strict: true,
})
