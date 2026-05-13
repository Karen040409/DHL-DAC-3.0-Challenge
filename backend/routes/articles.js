import { Router } from 'express'
import pool from '../db/pool.js'
import {
  attachTagsToRows,
  linkTagsToArticle,
  parseTagNames,
} from './articleTags.js'

const router = Router()

const ARTICLE_STATUSES = new Set(['Draft', 'Reviewed', 'Published'])

function parseDateParam(value) {
  if (value === undefined || value === null || value === '') return null
  const s = String(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

router.get('/', async (req, res) => {
  const { status, tag, creator_id: creatorIdRaw, updated_from, updated_to } = req.query

  if (status !== undefined && status !== '' && !ARTICLE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status filter' })
  }

  let creatorId = null
  if (creatorIdRaw !== undefined && creatorIdRaw !== '') {
    creatorId = Number(creatorIdRaw)
    if (!Number.isInteger(creatorId) || creatorId < 1) {
      return res.status(400).json({ error: 'Invalid creator_id' })
    }
  }

  const dateFrom = parseDateParam(updated_from)
  const dateTo = parseDateParam(updated_to)

  try {
    let sql = `SELECT DISTINCT a.id, a.title, a.summary, a.content, a.status, a.creator_id, a.created_at, a.updated_at,
       uc.username AS creator_username
       FROM articles a
       LEFT JOIN users uc ON uc.id = a.creator_id`
    const joins = []
    const cond = []
    const params = []

    if (tag !== undefined && tag !== '') {
      joins.push(
        `INNER JOIN article_tags at ON a.id = at.article_id INNER JOIN tags t ON at.tag_id = t.id`,
      )
      cond.push(`LOWER(t.name) = LOWER(?)`)
      params.push(String(tag))
    }
    if (status !== undefined && status !== '') {
      cond.push(`a.status = ?`)
      params.push(status)
    }
    if (creatorId !== null) {
      cond.push(`a.creator_id = ?`)
      params.push(creatorId)
    }
    if (dateFrom) {
      cond.push(`DATE(a.updated_at) >= ?`)
      params.push(dateFrom)
    }
    if (dateTo) {
      cond.push(`DATE(a.updated_at) <= ?`)
      params.push(dateTo)
    }

    sql += joins.join(' ')
    if (cond.length) sql += ` WHERE ${cond.join(' AND ')}`
    sql += ` ORDER BY a.updated_at DESC`

    const [rows] = await pool.query(sql, params)
    res.json(await attachTagsToRows(rows))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list articles' })
  }
})

router.post('/', async (req, res) => {
  const { title, summary, content, creator_id: creatorId } = req.body ?? {}
  const tagNames = parseTagNames(req.body)

  if (title === undefined || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required' })
  }
  if (creatorId === undefined || creatorId === null || creatorId === '') {
    return res.status(400).json({ error: 'creator_id is required' })
  }

  const conn = await pool.getConnection()
  try {
    const [userRows] = await conn.query(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      [creatorId],
    )
    if (userRows.length === 0) {
      res.status(400).json({ error: 'creator_id does not reference a valid user' })
      return
    }

    await conn.beginTransaction()

    const [result] = await conn.query(
      `INSERT INTO articles (title, summary, content, status, creator_id)
       VALUES (?, ?, ?, 'Draft', ?)`,
      [
        String(title).trim(),
        summary == null ? null : String(summary),
        content == null ? null : String(content),
        creatorId,
      ],
    )

    const articleId = result.insertId
    await linkTagsToArticle(conn, articleId, tagNames)

    await conn.query(
      `INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id)
       VALUES (?, NULL, 'Draft', ?)`,
      [articleId, creatorId],
    )

    await conn.commit()

    const [created] = await pool.query(
      `SELECT id, title, summary, content, status, creator_id, created_at, updated_at
       FROM articles WHERE id = ?`,
      [articleId],
    )
    const [withTags] = await attachTagsToRows(created)
    res.status(201).json(withTags)
  } catch (err) {
    try {
      await conn.rollback()
    } catch {
      /* no active transaction */
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create article' })
  } finally {
    conn.release()
  }
})

router.get('/:id(\\d+)/history', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const [rows] = await pool.query(
      `SELECT h.id, h.from_status, h.to_status, h.actor_user_id, h.changed_at,
              u.username AS actor_username
       FROM article_status_history h
       LEFT JOIN users u ON u.id = h.actor_user_id
       WHERE h.article_id = ?
       ORDER BY h.changed_at ASC, h.id ASC`,
      [id],
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load status history' })
  }
})

router.get('/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.summary, a.content, a.status, a.creator_id, a.created_at, a.updated_at,
              u.username AS creator_username
       FROM articles a
       LEFT JOIN users u ON u.id = a.creator_id
       WHERE a.id = ?`,
      [id],
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Article not found' })
    }
    const [withTags] = await attachTagsToRows(rows)
    res.json(withTags[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load article' })
  }
})

router.put('/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id)

  const { title, summary, content, status, actor_user_id: actorRaw } = req.body ?? {}
  if (status !== undefined && status !== null && !ARTICLE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' })
  }

  const fields = []
  const values = []

  if (title !== undefined) {
    if (String(title).trim() === '') {
      return res.status(400).json({ error: 'title cannot be empty' })
    }
    fields.push('title = ?')
    values.push(String(title).trim())
  }
  if (summary !== undefined) {
    fields.push('summary = ?')
    values.push(summary == null ? null : String(summary))
  }
  if (content !== undefined) {
    fields.push('content = ?')
    values.push(content == null ? null : String(content))
  }
  if (status !== undefined) {
    fields.push('status = ?')
    values.push(status)
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No updatable fields provided' })
  }

  values.push(id)

  let actorUserId = null
  if (actorRaw !== undefined && actorRaw !== null && actorRaw !== '') {
    const n = Number(actorRaw)
    if (Number.isInteger(n) && n >= 1) actorUserId = n
  }

  try {
    const [before] = await pool.query(
      'SELECT status FROM articles WHERE id = ? LIMIT 1',
      [id],
    )
    if (before.length === 0) {
      return res.status(404).json({ error: 'Article not found' })
    }
    const oldStatus = before[0].status

    const [result] = await pool.query(
      `UPDATE articles SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Article not found' })
    }

    if (status !== undefined && status !== oldStatus) {
      await pool.query(
        `INSERT INTO article_status_history (article_id, from_status, to_status, actor_user_id)
         VALUES (?, ?, ?, ?)`,
        [id, oldStatus, status, actorUserId],
      )
    }

    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.summary, a.content, a.status, a.creator_id, a.created_at, a.updated_at,
              u.username AS creator_username
       FROM articles a
       LEFT JOIN users u ON u.id = a.creator_id
       WHERE a.id = ?`,
      [id],
    )
    const [withTags] = await attachTagsToRows(rows)
    res.json(withTags[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update article' })
  }
})

router.delete('/:id(\\d+)', async (req, res) => {
  const id = Number(req.params.id)

  try {
    const [result] = await pool.query('DELETE FROM articles WHERE id = ?', [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Article not found' })
    }
    res.status(204).send()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to delete article' })
  }
})

export default router
