import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name FROM tags ORDER BY name ASC',
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list tags' })
  }
})

export default router
