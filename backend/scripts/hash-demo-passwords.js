#!/usr/bin/env node
/**
 * One-shot utility: replaces every seeded placeholder password_hash with a real
 * bcrypt hash of the demo password (default: "demo"). Safe to re-run — it only
 * touches rows whose password_hash still looks like a seed placeholder.
 *
 * Usage:
 *   node backend/scripts/hash-demo-passwords.js                # uses "demo"
 *   node backend/scripts/hash-demo-passwords.js MyOtherPass    # custom password
 *
 * Reads MySQL connection settings from backend/.env via env.js.
 */
import '../env.js'
import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'

const password = process.argv[2] || 'demo'

const PLACEHOLDER_LIKE = [
  '$2b$10$placeholder.demo.seed.hash%',
  'dummy_hash_for_now',
  '',
]

async function main() {
  const hash = await bcrypt.hash(password, 10)
  const [rows] = await pool.query(
    `SELECT id, username, role, password_hash
     FROM users
     WHERE password_hash LIKE ?
        OR password_hash = ?
        OR password_hash = ''
        OR password_hash IS NULL`,
    [PLACEHOLDER_LIKE[0], PLACEHOLDER_LIKE[1]],
  )

  if (rows.length === 0) {
    console.log('No placeholder password_hash rows found. Nothing to do.')
    return
  }

  for (const u of rows) {
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, u.id])
    console.log(`  rehashed  id=${u.id}  username=${u.username}  role=${u.role}`)
  }

  console.log(`\nUpdated ${rows.length} user(s). Demo login password: "${password}"`)
  console.log('\nTry one of these in the SmartHub Login page:')
  for (const u of rows) {
    console.log(`  ${u.username}  /  ${password}   (${u.role})`)
  }
}

main()
  .catch((err) => {
    console.error('[hash-demo-passwords] failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end().catch(() => undefined)
  })
