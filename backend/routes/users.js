import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

/** Public directory of editors (no password fields) for Viewer filters */
router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, role FROM users ORDER BY username ASC',
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list users' })
  }
})

export default router
