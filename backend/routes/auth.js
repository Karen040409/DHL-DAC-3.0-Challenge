import { Router } from 'express'
import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'

const router = Router()

const PLACEHOLDER_HASH_PREFIX = '$2b$10$placeholder.demo.seed.hash'
const DEMO_FALLBACK_PASSWORD = 'demo'

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: 200 { id, username, role } on success, 401 on bad credentials.
 *
 * Backwards-compatible password check:
 *   1. If the stored password_hash starts with `$2` (real bcrypt), use bcrypt.compare.
 *   2. If the stored password_hash is the demo seed placeholder, accept the literal
 *      password "demo" so the project still works out of the box before the
 *      hash-demo-passwords.js script is run.
 *   3. Otherwise reject with 401.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'username is required (min 2 chars)' })
  }
  if (typeof password !== 'string' || password.length < 1) {
    return res.status(400).json({ error: 'password is required' })
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, username, role, password_hash FROM users WHERE username = ? LIMIT 1',
      [username.trim()],
    )
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    const user = rows[0]
    const stored = user.password_hash ?? ''

    let ok = false
    if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
      if (stored.startsWith(PLACEHOLDER_HASH_PREFIX)) {
        ok = password === DEMO_FALLBACK_PASSWORD
      } else {
        ok = await bcrypt.compare(password, stored)
      }
    } else if (stored === 'dummy_hash_for_now' || stored === '') {
      ok = password === DEMO_FALLBACK_PASSWORD
    }

    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    res.json({ id: user.id, username: user.username, role: user.role })
  } catch (err) {
    console.error('[auth] login failed:', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

export default router
