import { Router } from 'express'
import crypto from 'node:crypto'
import multer from 'multer'
import mammoth from 'mammoth'
import pdfParseModule from 'pdf-parse'

const pdfFn =
  typeof pdfParseModule === 'function'
    ? pdfParseModule
    : pdfParseModule?.pdf ?? pdfParseModule?.default ?? null

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const TEXT_MIMES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
])

const PDF_MIMES = new Set(['application/pdf'])

const DOCX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

const MAX_CHARS = 50_000

async function extractFromBuffer(buffer, originalName, mimeType) {
  const ext = (originalName.split('.').pop() || '').toLowerCase()
  const mt = (mimeType || '').toLowerCase()

  if (PDF_MIMES.has(mt) || ext === 'pdf') {
    if (!pdfFn) throw new Error('pdf-parse module did not expose a callable export')
    const result = await pdfFn(buffer)
    const text = result?.text ?? result?.Text ?? ''
    const warning = text.trim().length === 0
      ? 'PDF had no extractable text (likely scanned image). Consider OCR.'
      : null
    return { kind: 'pdf', text, warning }
  }

  if (DOCX_MIMES.has(mt) || ext === 'docx') {
    const result = await mammoth.extractRawText({ buffer })
    return {
      kind: 'docx',
      text: result?.value ?? '',
      warning: result?.messages?.length
        ? `mammoth notes: ${result.messages.slice(0, 3).map((m) => m.message).join('; ')}`
        : null,
    }
  }

  if (TEXT_MIMES.has(mt) || ['txt', 'md', 'csv', 'json'].includes(ext)) {
    return { kind: 'text', text: buffer.toString('utf-8'), warning: null }
  }

  throw Object.assign(new Error(`Unsupported file kind: ${ext || mt || 'unknown'}`), { status: 415 })
}

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'No file uploaded. Send multipart/form-data with field "file".' })
  }

  const { buffer, originalname, mimetype, size } = req.file
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  try {
    const { kind, text, warning } = await extractFromBuffer(buffer, originalname, mimetype)
    const truncated = text.length > MAX_CHARS
    const finalText = truncated ? text.slice(0, MAX_CHARS) : text

    res.json({
      original_name: originalname,
      kind,
      mime_type: mimetype,
      size_bytes: size,
      content_hash: hash,
      char_count: finalText.length,
      truncated,
      warning,
      text: finalText,
    })
  } catch (err) {
    const code = err.status || 500
    if (code >= 500) console.error('[extract] failed:', err)
    res.status(code).json({ error: err.message || 'Extraction failed' })
  }
})

export default router
