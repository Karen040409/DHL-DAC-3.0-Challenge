import { Router } from 'express'
import pool from '../db/pool.js'

const router = Router()

const ARTICLE_STATUSES = new Set(['Draft', 'Reviewed', 'Published'])

router.get('/', async (req, res) => {
  const { status, tag } = req.query

  if (status !== undefined && status !== '' && !ARTICLE_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status filter' })
  }

  try {
    let sql = `SELECT DISTINCT a.id, a.title, a.summary, a.content, a.status, a.creator_id, a.created_at, a.updated_at FROM articles a`
    const params = []

    if (tag !== undefined && tag !== '') {
      sql += `
        INNER JOIN article_tags at ON a.id = at.article_id
        INNER JOIN tags t ON at.tag_id = t.id`
      if (status !== undefined && status !== '') {
        sql += ` WHERE a.status = ? AND LOWER(t.name) = LOWER(?)`
        params.push(status, String(tag))
      } else {
        sql += ` WHERE LOWER(t.name) = LOWER(?)`
        params.push(String(tag))
      }
    } else if (status !== undefined && status !== '') {
      sql += ` WHERE a.status = ?`
      params.push(status)
    }

    sql += ` ORDER BY a.updated_at DESC`

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to list articles' })
  }
})

router.post('/', async (req, res) => {
  const { title, summary, content, creator_id: creatorId } = req.body ?? {}

  if (title === undefined || String(title).trim() === '') {
    return res.status(400).json({ error: 'title is required' })
  }
  if (creatorId === undefined || creatorId === null || creatorId === '') {
    return res.status(400).json({ error: 'creator_id is required' })
  }

  try {
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      [creatorId],
    )
    if (userRows.length === 0) {
      return res.status(400).json({ error: 'creator_id does not reference a valid user' })
    }

    const [result] = await pool.query(
      `INSERT INTO articles (title, summary, content, status, creator_id)
       VALUES (?, ?, ?, 'Draft', ?)`,
      [
        String(title).trim(),
        summary == null ? null : String(summary),
        content == null ? null : String(content),
        creatorId,
      ],
    )

    const [created] = await pool.query(
      `SELECT id, title, summary, content, status, creator_id, created_at, updated_at
       FROM articles WHERE id = ?`,
      [result.insertId],
    )
    res.status(201).json(created[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create article' })
  }
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid article id' })
  }

  const { title, summary, content, status } = req.body ?? {}
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

  try {
    const [result] = await pool.query(
      `UPDATE articles SET ${fields.join(', ')} WHERE id = ?`,
      values,
    )
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Article not found' })
    }
    const [rows] = await pool.query(
      `SELECT id, title, summary, content, status, creator_id, created_at, updated_at
       FROM articles WHERE id = ?`,
      [id],
    )
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update article' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid article id' })
  }

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
