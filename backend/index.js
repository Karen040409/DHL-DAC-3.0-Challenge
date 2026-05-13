import './env.js'
import express from 'express'
import cors from 'cors'
import articlesRouter from './routes/articles.js'
import tagsRouter from './routes/tags.js'
import usersRouter from './routes/users.js'
import ingestionRouter from './routes/ingestion.js'
import extractRouter from './routes/extract.js'
import ocrRouter from './routes/ocr.js'
import authRouter from './routes/auth.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))
// Same POST /api/articles accepts JSON or form fields (easier for UiPath than raw JSON)
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dhl-kb-api' })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'DHL SmartHub API',
    message: 'Use /api/* routes. The web UI runs separately (e.g. Vite on port 5173).',
    routes: {
      health: 'GET /api/health',
      articles: 'GET|POST /api/articles',
      attachments: 'GET|POST /api/articles/:id/attachments',
      ingestion: 'POST /api/ingestion/check-duplicate, POST /api/ingestion/log, GET /api/ingestion/recent',
      conflicts: 'GET /api/articles/conflicts?title=...',
      extract: 'POST /api/extract (multipart field: file) -> { text, kind, hash, ... }',
      ocr: 'POST /api/ocr (multipart field: file, optional lang) -> { text, kind: image, hash, ... }',
      auth: 'POST /api/auth/login { username, password } -> { id, username, role }',
      tags: 'GET /api/tags',
      users: 'GET /api/users',
    },
  })
})

app.use('/api/articles', articlesRouter)
app.use('/api/tags', tagsRouter)
app.use('/api/users', usersRouter)
app.use('/api/ingestion', ingestionRouter)
app.use('/api/extract', extractRouter)
app.use('/api/ocr', ocrRouter)
app.use('/api/auth', authRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Malformed JSON (e.g. body literally "jsonBody") — respond 400 without killing the process
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') {
    console.warn('[api] Invalid JSON body:', err.body)
    return res.status(400).json({
      error: 'Invalid JSON body',
      hint: 'UiPath: use Content-Type application/x-www-form-urlencoded with fields title, summary, content, creator_id — or bind JSON in the expression editor (not plain text jsonBody).',
    })
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
