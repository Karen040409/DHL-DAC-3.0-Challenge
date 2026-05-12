import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import articlesRouter from './routes/articles.js'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  }),
)
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dhl-kb-api' })
})

app.use('/api/articles', articlesRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})
