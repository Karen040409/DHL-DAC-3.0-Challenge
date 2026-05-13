import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createArticle,
  extractTextFromFile,
  findConflicts,
  uploadAttachments,
} from '../services/api.js'
import { proposeDraft } from '../services/draftBuilder.js'
import { getSession } from '../auth/session.js'
import styles from './UploadConsole.module.css'

function isExtractable(file) {
  const name = (file?.name || '').toLowerCase()
  return /\.(pdf|docx|txt|md|csv|json)$/.test(name)
}

function buildContent(raw, files, steps) {
  const names = files.map((f) => f.name).filter(Boolean)
  const header =
    names.length > 0
      ? `Attached files (uploaded to server): ${names.join(', ')}\n\n---\n\n`
      : ''
  const stepBlock =
    steps && steps.length > 0
      ? `Proposed steps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n---\n\n`
      : ''
  return `${header}${stepBlock}${raw}`.trim() || null
}

export default function UploadConsole() {
  const session = getSession()
  const fileRef = useRef(null)

  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [rawText, setRawText] = useState('')
  const [files, setFiles] = useState([])
  const [proposedSteps, setProposedSteps] = useState([])
  const [proposalNotes, setProposalNotes] = useState([])
  const [relatedLinks, setRelatedLinks] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [conflicts, setConflicts] = useState([])
  const [conflictBusy, setConflictBusy] = useState(false)
  const [extractBusy, setExtractBusy] = useState(false)
  const [extractStatus, setExtractStatus] = useState(null)

  const extractableCount = files.filter(isExtractable).length
  const canPropose = rawText.trim().length > 0 || files.length > 0

  useEffect(() => {
    const t = title.trim()
    if (t.length < 4) {
      setConflicts([])
      return undefined
    }
    const ac = new AbortController()
    const timer = window.setTimeout(async () => {
      setConflictBusy(true)
      try {
        const rows = await findConflicts(t, '', ac.signal)
        if (Array.isArray(rows)) setConflicts(rows)
      } catch {
        /* ignore — conflicts are advisory */
      } finally {
        setConflictBusy(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      ac.abort()
    }
  }, [title])

  function onFilesPicked(e) {
    const list = e.target.files ? Array.from(e.target.files) : []
    setFiles(list)
    setExtractStatus(null)
  }

  async function handleExtractFromFiles() {
    const targets = files.filter(isExtractable)
    if (targets.length === 0) return
    setExtractBusy(true)
    setExtractStatus(null)
    setError(null)

    const results = []
    const warnings = []
    for (const f of targets) {
      try {
        const r = await extractTextFromFile(f)
        if (r.text && r.text.trim().length > 0) {
          results.push(`--- ${r.original_name} (${r.kind}, ${r.char_count} chars) ---\n${r.text}`)
        }
        if (r.warning) warnings.push(`${r.original_name}: ${r.warning}`)
      } catch (e) {
        warnings.push(`${f.name}: ${e instanceof Error ? e.message : 'extract failed'}`)
      }
    }

    if (results.length > 0) {
      const joined = results.join('\n\n')
      setRawText((prev) => (prev.trim().length > 0 ? `${prev}\n\n${joined}` : joined))
    }
    const msg = []
    if (results.length > 0) msg.push(`Extracted text from ${results.length} file${results.length === 1 ? '' : 's'}.`)
    if (warnings.length > 0) msg.push(warnings.join(' '))
    setExtractStatus(msg.join(' '))
    setExtractBusy(false)
  }

  function applyDraftProposal() {
    const fileNames = files.map((f) => f.name)
    const proposal = proposeDraft(rawText, fileNames)
    setTitle((prev) => (prev.trim() ? prev : proposal.title))
    setSummary((prev) => (prev.trim() ? prev : proposal.summary))
    setTagsInput((prev) => {
      const existing = prev
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      const merged = [...new Set([...existing, ...proposal.tags])]
      return merged.join(', ')
    })
    setProposedSteps(proposal.steps)
    setProposalNotes(proposal.notes)
    setRelatedLinks(proposal.related_links)
    setDone(null)
    setError(null)
  }

  function clearProposal() {
    setProposedSteps([])
    setProposalNotes([])
    setRelatedLinks([])
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

    const finalTitle =
      title.trim() || proposeDraft(rawText, files.map((f) => f.name)).title
    const finalSummary =
      summary.trim() || proposeDraft(rawText, files.map((f) => f.name)).summary

    const content = buildContent(raw, files, proposedSteps)
    const tags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    setBusy(true)
    try {
      const created = await createArticle({
        title: finalTitle,
        summary: finalSummary,
        content,
        creator_id: session.userId,
        ...(tags.length > 0 ? { tags } : {}),
      })

      let uploadedCount = 0
      if (files.length > 0) {
        try {
          const result = await uploadAttachments(created.id, files, session.userId)
          uploadedCount = result?.uploaded?.length ?? 0
        } catch (e) {
          setError(
            `Draft saved (#${created.id}) but attachment upload failed: ${
              e instanceof Error ? e.message : String(e)
            }`,
          )
        }
      }
      setDone(
        `Saved draft #${created.id} — “${created.title}”${
          uploadedCount > 0 ? ` with ${uploadedCount} attachment${uploadedCount === 1 ? '' : 's'}` : ''
        }.`,
      )
      setRawText('')
      setTitle('')
      setSummary('')
      setTagsInput('')
      setFiles([])
      clearProposal()
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create article.')
    } finally {
      setBusy(false)
    }
  }

  const conflictBlock = useMemo(() => {
    if (!conflicts.length) return null
    return (
      <div className={styles.conflict} role="alert">
        <strong>Possible duplicate:</strong> {conflicts.length} existing article
        {conflicts.length === 1 ? '' : 's'} share words with this title.
        <ul>
          {conflicts.slice(0, 5).map((c) => (
            <li key={c.id}>
              #{c.id} <strong>{c.title}</strong> · {c.status}
              {c.creator_username ? ` · by ${c.creator_username}` : null}
            </li>
          ))}
        </ul>
      </div>
    )
  }, [conflicts])

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Upload console</h1>
        <p className={styles.lead}>
          Paste messy operational input (Teams threads, emails, notes) or attach PDF/DOCX
          files. Use <strong>Propose draft</strong> to auto-fill a title, summary, tags and
          step list, then save as a <strong>Draft</strong> via the REST API. Attachments are
          stored on the server and downloadable from the Viewer.
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
            <label htmlFor="upload-raw">Raw unstructured text</label>
            <textarea
              id="upload-raw"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste chat exports, email threads, or quick SOP notes…"
            />
          </div>

          <div className={styles.proposalBar}>
            <button
              type="button"
              className={styles.secondary}
              onClick={applyDraftProposal}
              disabled={!canPropose}
              title="Generates title, summary, tags and steps locally — no LLM key required."
            >
              Propose draft (AI-style)
            </button>
            {proposalNotes.length > 0 ? (
              <ul className={styles.notes}>
                {proposalNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className={styles.field}>
            <label htmlFor="upload-title">Title</label>
            <input
              id="upload-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-derived from first line when blank"
            />
            {conflictBusy ? (
              <p className={styles.muted}>Checking for similar published articles…</p>
            ) : null}
            {conflictBlock}
          </div>

          <div className={styles.field}>
            <label htmlFor="upload-summary">Summary</label>
            <textarea
              id="upload-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One or two sentences — auto-filled by Propose draft"
              style={{ minHeight: '5rem' }}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="upload-tags">Tags (comma-separated)</label>
            <input
              id="upload-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Logistics, SOP, Dock Operations"
            />
          </div>

          {proposedSteps.length > 0 ? (
            <div className={styles.field}>
              <label>Proposed steps (included in article content)</label>
              <ol className={styles.steps}>
                {proposedSteps.map((s, i) => (
                  <li key={`${i}-${s.slice(0, 20)}`}>
                    <input
                      value={s}
                      onChange={(e) => {
                        const next = [...proposedSteps]
                        next[i] = e.target.value
                        setProposedSteps(next)
                      }}
                    />
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() =>
                        setProposedSteps(proposedSteps.filter((_, idx) => idx !== i))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {relatedLinks.length > 0 ? (
            <div className={styles.field}>
              <label>Related links detected</label>
              <ul className={styles.linkList}>
                {relatedLinks.map((l) => (
                  <li key={l}>
                    <a href={l} target="_blank" rel="noreferrer">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className={styles.drop}>
            <div className={styles.dropHead}>
              <span className={styles.dropTitle}>Files (PDF, DOCX, images)</span>
              <label className={styles.fileBtn} htmlFor="smarthub-upload-files">
                Browse
              </label>
              <input
                ref={fileRef}
                id="smarthub-upload-files"
                className={styles.hiddenInput}
                type="file"
                accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
                multiple
                onChange={onFilesPicked}
              />
            </div>
            {files.length === 0 ? (
              <p className={styles.muted}>
                No files selected. Selected files are saved on the server and listed on the
                Viewer with download links.
              </p>
            ) : (
              <ul className={styles.fileList}>
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`}>
                    {f.name} <span className={styles.muted}>({Math.round(f.size / 1024)} KB)</span>
                    {isExtractable(f) ? null : (
                      <span className={styles.muted}> · binary (will be attached but not parsed)</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {extractableCount > 0 ? (
              <div className={styles.extractRow}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={handleExtractFromFiles}
                  disabled={extractBusy}
                  title="Sends each PDF/DOCX/TXT to /api/extract and appends the extracted text below."
                >
                  {extractBusy
                    ? 'Extracting…'
                    : `Extract text from ${extractableCount} file${extractableCount === 1 ? '' : 's'}`}
                </button>
                {extractStatus ? (
                  <span className={styles.muted}>{extractStatus}</span>
                ) : null}
              </div>
            ) : null}
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
