/**
 * OCR for image uploads via offline Tesseract.js.
 * Default language is `eng`; optional multipart field `lang` overrides (whitelisted).
 * Trained data for the chosen language(s) is fetched by Tesseract.js on first use when missing locally.
 */
import { Router } from 'express'
import crypto from 'node:crypto'
import multer from 'multer'
import { createWorker } from 'tesseract.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const MAX_CHARS = 50_000

const IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

const LANG_PATTERN = /^[a-z+_]{1,40}$/

let workerPromise = null
let workerReadyLang = null

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker()
      await worker.loadLanguage('eng')
      await worker.initialize('eng')
      workerReadyLang = 'eng'
      return worker
    })()
  }
  return workerPromise
}

async function ensureWorkerLang(worker, lang) {
  if (workerReadyLang === lang) return
  await worker.loadLanguage(lang)
  await worker.initialize(lang)
  workerReadyLang = lang
}

function isSupportedImage(originalName, mimeType) {
  const ext = (originalName.split('.').pop() || '').toLowerCase()
  const mt = (mimeType || '').toLowerCase()
  return IMAGE_MIMES.has(mt) || IMAGE_EXTS.has(ext)
}

function resolveLang(body) {
  const raw = typeof body?.lang === 'string' ? body.lang.trim() : ''
  if (raw && LANG_PATTERN.test(raw)) return raw
  return 'eng'
}

process.once('beforeExit', () => {
  if (!workerPromise) return
  workerPromise
    .then((worker) => worker?.terminate?.())
    .catch(() => {})
})

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ error: 'No file uploaded. Send multipart/form-data with field "file".' })
  }

  const { buffer, originalname, mimetype, size } = req.file

  if (!isSupportedImage(originalname, mimetype)) {
    return res.status(415).json({
      error: `Unsupported image type (mime: ${mimetype || 'unknown'}). Use PNG, JPEG, WEBP, or GIF.`,
    })
  }

  const lang = resolveLang(req.body)
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')

  try {
    const worker = await getWorker()
    await ensureWorkerLang(worker, lang)
    const { data } = await worker.recognize(buffer)
    const rawText = data?.text ?? ''
    const truncated = rawText.length > MAX_CHARS
    const finalText = truncated ? rawText.slice(0, MAX_CHARS) : rawText
    const warning =
      rawText.trim().length === 0
        ? 'OCR produced no text — image may be too small or low contrast.'
        : null

    res.json({
      original_name: originalname,
      kind: 'image',
      mime_type: mimetype,
      size_bytes: size,
      content_hash: hash,
      char_count: finalText.length,
      truncated,
      warning,
      text: finalText,
    })
  } catch (err) {
    console.error('[ocr] failed:', err)
    res.status(500).json({ error: err.message || 'OCR failed' })
  }
})

export default router
