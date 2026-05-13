import { Router } from 'express'
import crypto from 'node:crypto'
import pool from '../db/pool.js'

const router = Router()

const ALLOWED_OUTCOMES = new Set(['created', 'duplicate', 'failed', 'updated'])

function normaliseHash(value) {
  if (value == null) return null
  const trimmed = String(value).trim().toLowerCase()
  if (/^[a-f0-9]{64}$/.test(trimmed)) return trimmed
  return null
}

function hashFromText(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex')
}

/**
 * POST /api/ingestion/check-duplicate
 * Body (any combination):
 *   { content_hash: "<sha256 hex>" }        // RPA already hashed the file
 *   { text: "..." }                          // server hashes for you
 * Optional: { window_days: number = 14 }
 *
 * Returns: { duplicate: bool, content_hash, last_seen_at|null, article_id|null, window_days }
 * "duplicate" is true when the same hash was logged in the lookback window.
 */
router.post('/check-duplicate', async (req, res) => {
  const body = req.body ?? {}
  let hash = normaliseHash(body.content_hash)
  if (!hash && typeof body.text === 'string' && body.text.length > 0) {
    hash = hashFromText(body.text)
  }
  if (!hash) {
    return res.status(400).json({
      error: 'Provide content_hash (sha256 hex) or text to hash on the server.',
    })
  }

  const windowDays = Number(body.window_days ?? 14)
  const safeWindow =
    Number.isFinite(windowDays) && windowDays > 0 && windowDays <= 365 ? Math.floor(windowDays) : 14

  try {
    const [rows] = await pool.query(
      `SELECT id, article_id, outcome, processed_at
       FROM processing_log
       WHERE content_hash = ?
         AND outcome IN ('created', 'updated')
         AND processed_at >= (NOW() - INTERVAL ? DAY)
       ORDER BY processed_at DESC
       LIMIT 1`,
      [hash, safeWindow],
    )
    if (rows.length === 0) {
      return res.json({
        duplicate: false,
        content_hash: hash,
        last_seen_at: null,
        article_id: null,
        window_days: safeWindow,
      })
    }
    const row = rows[0]
    res.json({
      duplicate: true,
      content_hash: hash,
      last_seen_at: row.processed_at,
      article_id: row.article_id,
      window_days: safeWindow,
    })
  } catch (err) {
    console.error('[ingestion] check-duplicate failed:', err)
    res.status(500).json({ error: 'Duplicate check failed' })
  }
})

/**
 * POST /api/ingestion/log
 * Body: {
 *   content_hash: "<sha256 hex>"  (required, or pass text)
 *   text?: "...",
 *   source_path?: "drive://...",
 *   source_kind?: "rpa" | "drive" | "email" | "manual",
 *   outcome: "created" | "duplicate" | "failed" | "updated",
 *   article_id?: number,
 *   message?: string
 * }
 */
router.post('/log', async (req, res) => {
  const body = req.body ?? {}
  const outcome = String(body.outcome ?? '').toLowerCase()
  if (!ALLOWED_OUTCOMES.has(outcome)) {
    return res
      .status(400)
      .json({ error: `outcome must be one of ${[...ALLOWED_OUTCOMES].join(', ')}` })
  }

  let hash = normaliseHash(body.content_hash)
  if (!hash && typeof body.text === 'string' && body.text.length > 0) {
    hash = hashFromText(body.text)
  }
  if (!hash) {
    return res
      .status(400)
      .json({ error: 'Provide content_hash (sha256 hex) or text to hash on the server.' })
  }

  let articleId = null
  if (body.article_id !== undefined && body.article_id !== null && body.article_id !== '') {
    const n = Number(body.article_id)
    if (Number.isInteger(n) && n >= 1) articleId = n
  }

  const sourcePath = body.source_path == null ? null : String(body.source_path).slice(0, 500)
  const sourceKind = String(body.source_kind ?? 'rpa').slice(0, 40)
  const message = body.message == null ? null : String(body.message).slice(0, 500)

  try {
    const [result] = await pool.query(
      `INSERT INTO processing_log
         (content_hash, source_path, source_kind, outcome, article_id, message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [hash, sourcePath, sourceKind, outcome, articleId, message],
    )
    res.status(201).json({ id: result.insertId, content_hash: hash, outcome })
  } catch (err) {
    console.error('[ingestion] log insert failed:', err)
    res.status(500).json({ error: 'Failed to record processing log' })
  }
})

/**
 * GET /api/ingestion/recent?limit=20
 * Quick view of recent RPA processing events (for admins / debugging).
 */
router.get('/recent', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 200)
  try {
    const [rows] = await pool.query(
      `SELECT id, content_hash, source_path, source_kind, outcome, article_id, message, processed_at
       FROM processing_log
       ORDER BY processed_at DESC, id DESC
       LIMIT ?`,
      [limit],
    )
    res.json(rows)
  } catch (err) {
    console.error('[ingestion] recent fetch failed:', err)
    res.status(500).json({ error: 'Failed to list processing log' })
  }
})

export default router
