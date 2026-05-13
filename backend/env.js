import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.warn(`[env] Could not read ${envPath} — using process env / defaults. (${result.error.message})`)
} else {
  console.log(`[env] Loaded ${envPath}`)
}

const hasDbPassword = Boolean(process.env.DB_PASSWORD && String(process.env.DB_PASSWORD).length > 0)
console.log(
  `[db] host=${process.env.DB_HOST ?? 'localhost'} user=${process.env.DB_USER ?? 'root'} database=${process.env.DB_NAME ?? 'dhl_kb'} password=${hasDbPassword ? 'set' : 'MISSING (MySQL will reject root with NO password)'}`,
)
