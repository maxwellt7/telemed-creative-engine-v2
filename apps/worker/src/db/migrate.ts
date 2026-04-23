import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(sql)

const migrationsFolder = join(__dirname, '../../drizzle')
await migrate(db, { migrationsFolder })
console.log('[migrate] Migrations complete')
await sql.end()
