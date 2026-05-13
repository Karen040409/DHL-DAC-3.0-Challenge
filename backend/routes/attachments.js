import { Router } from 'express'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import multer from 'multer'
import pool from '../db/pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads')

fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 16)
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 80)
    const rand = crypto.randomBytes(6).toString('hex')
    cb(null, `${Date.now()}_${rand}_${safeBase || 'file'}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 8 },
})

function hashFile(absolutePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256')
    fs.createReadStream(absolutePath)
      .on('error', reject)
      .on('data', (chunk) => h.update(chunk))
      .on('end', () => resolve(h.digest('hex')))
  })
}

const router = Router({ mergeParams: true })

async function loadAttachmentRows(articleId) {
  const [rows] = await pool.query(
    `SELECT id, article_id, original_name, stored_name, mime_type, size_bytes,
            content_hash, uploaded_by, uploaded_at
     FROM article_attachments
     WHERE article_id = ?
     ORDER BY uploaded_at ASC, id ASC`,
    [articleId],
  )
  return rows.map((r) => ({ ...r, download_url: `/api/articles/${r.article_id}/attachments/${r.id}/download` }))
}

router.get('/', async (req, res) => {
  const articleId = Number(req.params.articleId)
  if (!Number.isInteger(articleId) || articleId < 1) {
    return res.status(400).json({ error: 'Invalid articleId' })
  }
  try {
    const rows = await loadAttachmentRows(articleId)
    res.json(rows)
  } catch (err) {
    console.error('[attachments] list failed:', err)
    res.status(500).json({ error: 'Failed to list attachments' })
  }
})

router.post('/', upload.array('files', 8), async (req, res) => {
  const articleId = Number(req.params.articleId)
  if (!Number.isInteger(articleId) || articleId < 1) {
    return res.status(400).json({ error: 'Invalid articleId' })
  }
  const files = req.files ?? []
  if (files.length === 0) {
    return res
      .status(400)
      .json({ error: 'No files received. Send multipart/form-data with field "files".' })
  }

  let uploadedBy = null
  const actorRaw = req.body?.uploaded_by ?? req.body?.actor_user_id
  if (actorRaw !== undefined && actorRaw !== null && actorRaw !== '') {
    const n = Number(actorRaw)
    if (Number.isInteger(n) && n >= 1) uploadedBy = n
  }

  try {
    const [exists] = await pool.query('SELECT id FROM articles WHERE id = ? LIMIT 1', [articleId])
    if (exists.length === 0) {
      for (const f of files) {
        fs.unlink(f.path, () => undefined)
      }
      return res.status(404).json({ error: 'Article not found' })
    }

    const inserted = []
    for (const f of files) {
      let hash = null
      try {
        hash = await hashFile(f.path)
      } catch (e) {
        console.warn('[attachments] hashing failed:', e?.message)
      }
      const [result] = await pool.query(
        `INSERT INTO article_attachments
           (article_id, original_name, stored_name, mime_type, size_bytes, content_hash, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [articleId, f.originalname, f.filename, f.mimetype ?? null, f.size, hash, uploadedBy],
      )
      inserted.push(result.insertId)
    }

    const allRows = await loadAttachmentRows(articleId)
    const newlyInserted = allRows.filter((r) => inserted.includes(r.id))
    res.status(201).json({ uploaded: newlyInserted, all: allRows })
  } catch (err) {
    console.error('[attachments] upload failed:', err)
    for (const f of files) {
      fs.unlink(f.path, () => undefined)
    }
    res.status(500).json({ error: 'Failed to save attachments' })
  }
})

router.get('/:attId(\\d+)/download', async (req, res) => {
  const articleId = Number(req.params.articleId)
  const attId = Number(req.params.attId)
  if (!Number.isInteger(articleId) || !Number.isInteger(attId)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  try {
    const [rows] = await pool.query(
      `SELECT original_name, stored_name, mime_type
       FROM article_attachments
       WHERE id = ? AND article_id = ?
       LIMIT 1`,
      [attId, articleId],
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' })
    }
    const row = rows[0]
    const absolute = path.join(UPLOAD_DIR, row.stored_name)
    if (!fs.existsSync(absolute)) {
      return res.status(410).json({ error: 'File missing on disk' })
    }
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(row.original_name)}"`,
    )
    fs.createReadStream(absolute).pipe(res)
  } catch (err) {
    console.error('[attachments] download failed:', err)
    res.status(500).json({ error: 'Failed to read attachment' })
  }
})

router.delete('/:attId(\\d+)', async (req, res) => {
  const articleId = Number(req.params.articleId)
  const attId = Number(req.params.attId)
  if (!Number.isInteger(articleId) || !Number.isInteger(attId)) {
    return res.status(400).json({ error: 'Invalid id' })
  }
  try {
    const [rows] = await pool.query(
      `SELECT stored_name FROM article_attachments WHERE id = ? AND article_id = ? LIMIT 1`,
      [attId, articleId],
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' })
    }
    const absolute = path.join(UPLOAD_DIR, rows[0].stored_name)
    await pool.query('DELETE FROM article_attachments WHERE id = ?', [attId])
    fs.unlink(absolute, () => undefined)
    res.status(204).send()
  } catch (err) {
    console.error('[attachments] delete failed:', err)
    res.status(500).json({ error: 'Failed to delete attachment' })
  }
})

export default router
