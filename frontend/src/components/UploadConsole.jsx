import { useRef, useState } from 'react'
import { createArticle } from '../services/api.js'
import { getSession } from '../auth/session.js'
import styles from './UploadConsole.module.css'

function deriveTitle(raw, explicitTitle) {
  const t = explicitTitle.trim()
  if (t) return t
  const line = raw.split('\n').find((l) => l.trim().length > 0)
  if (line) return line.trim().slice(0, 200)
  return 'Untitled draft'
}

function buildContent(raw, files) {
  const names = files.map((f) => f.name).filter(Boolean)
  const header =
    names.length > 0
      ? `Attached files (simulated ingestion): ${names.join(', ')}\n\n---\n\n`
      : ''
  return `${header}${raw}`.trim() || null
}

export default function UploadConsole() {
  const session = getSession()
  const fileRef = useRef(null)

  const [title, setTitle] = useState('')
  const [rawText, setRawText] = useState('')
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  function onFilesPicked(e) {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles(list)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setDone(null)

    if (!session) {
      setError('You need to be signed in.')
      return
    }

    const raw = rawText.trim()
    if (!raw && files.length === 0) {
      setError('Add unstructured text or select at least one PDF/DOCX file.')
      return
    }

    const finalTitle = deriveTitle(rawText, title)
    const summary =
      raw.slice(0, 400) + (raw.length > 400 ? '…' : '') || 'Draft created from upload console.'
    const content = buildContent(raw, files)

    setBusy(true)
    try {
      const created = await createArticle({
        title: finalTitle,
        summary,
        content,
        creator_id: session.userId,
      })
      setDone(`Saved draft #${created.id} — “${created.title}”.`)
      setRawText('')
      setTitle('')
      setFiles([])
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create article.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Upload console</h1>
        <p className={styles.lead}>
          Paste messy operational input (Teams threads, emails, notes) or attach PDF/DOCX
          files. Submitting creates a new <strong>Draft</strong> article via the REST API.
        </p>
      </header>

      <div className={styles.card}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {done ? (
            <p className={styles.success} role="status">
              {done}
            </p>
          ) : null}

          <div className={styles.field}>
            <label htmlFor="upload-title">Article title (optional)</label>
            <input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Overrides first line of pasted text"
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="upload-raw">Raw unstructured text</label>
            <textarea
              id="upload-raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste chat exports, email threads, or quick SOP notes…"
            />
          </div>

          <div className={styles.drop}>
            <div className={styles.dropHead}>
              <span className={styles.dropTitle}>Files (PDF, DOCX)</span>
              <label className={styles.fileBtn} htmlFor="smarthub-upload-files">
                Browse
              </label>
              <input
                ref={fileRef}
                id="smarthub-upload-files"
                className={styles.hiddenInput}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                multiple
                onChange={onFilesPicked}
              />
            </div>
            {files.length === 0 ? (
              <p className={styles.muted}>No files selected — filenames are recorded in article content for this MVP.</p>
            ) : (
              <ul className={styles.fileList}>
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>{f.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className={styles.actions}>
            <button className={styles.primary} type="submit" disabled={busy}>
              {busy ? 'Saving draft…' : 'Save as Draft'}
            </button>
            {session ? (
              <span className={styles.muted}>
                Signed in as <strong>{session.username}</strong> (creator_id {session.userId})
              </span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
