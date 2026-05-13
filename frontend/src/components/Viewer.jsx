import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteArticle,
  fetchArticleHistory,
  fetchArticles,
  fetchTags,
  fetchUsers,
  updateArticleStatus,
} from '../services/api.js'
import { getSession } from '../auth/session.js'
import styles from './Viewer.module.css'

function statusClass(s) {
  if (s === 'Draft') return styles.draft
  if (s === 'Reviewed') return styles.reviewed
  if (s === 'Published') return styles.published
  return ''
}

function nextStatus(current) {
  if (current === 'Draft') return 'Reviewed'
  if (current === 'Reviewed') return 'Published'
  return null
}

function nextLabel(current) {
  if (current === 'Draft') return 'Move to Reviewed'
  if (current === 'Reviewed') return 'Publish'
  return null
}

function formatHistoryRow(h) {
  const from = h.from_status == null ? '—' : h.from_status
  const to = h.to_status ?? '—'
  const who = h.actor_username || (h.actor_user_id ? `#${h.actor_user_id}` : 'System')
  const when = h.changed_at ? new Date(h.changed_at).toLocaleString() : '—'
  return `${when}: ${from} → ${to} (${who})`
}

export default function Viewer() {
  const session = getSession()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [creatorFilter, setCreatorFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [articles, setArticles] = useState([])
  const [tags, setTags] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const [historyArticle, setHistoryArticle] = useState(null)
  const [historyRows, setHistoryRows] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  const loadArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchArticles({
        status: statusFilter || undefined,
        tag: tagFilter || undefined,
        creator_id: creatorFilter || undefined,
        updated_from: dateFrom || undefined,
        updated_to: dateTo || undefined,
      })
      setArticles(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load articles')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tagFilter, creatorFilter, dateFrom, dateTo])

  useEffect(() => {
    const ac = new AbortController()
    fetchTags(ac.signal)
      .then(setTags)
      .catch(() => setTags([]))
    fetchUsers(ac.signal)
      .then(setUsers)
      .catch(() => setUsers([]))
    return () => ac.abort()
  }, [])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => {
      const tagStr = Array.isArray(a.tags) ? a.tags.join(' ') : ''
      const creator = a.creator_username != null ? String(a.creator_username) : ''
      const hay =
        `${a.title ?? ''} ${a.summary ?? ''} ${a.content ?? ''} ${tagStr} ${creator}`.toLowerCase()
      return hay.includes(q)
    })
  }, [articles, search])

  async function onAdvance(a) {
    const n = nextStatus(a.status)
    if (!n) return
    setBusyId(a.id)
    setError(null)
    try {
      const updated = await updateArticleStatus(a.id, n, session?.userId)
      setArticles((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(a) {
    const ok = window.confirm(`Delete article #${a.id} "${a.title}"?`)
    if (!ok) return
    setBusyId(a.id)
    setError(null)
    try {
      await deleteArticle(a.id)
      setArticles((prev) => prev.filter((row) => row.id !== a.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  async function openHistory(a) {
    setHistoryArticle(a)
    setHistoryRows([])
    setHistoryError(null)
    setHistoryLoading(true)
    try {
      const rows = await fetchArticleHistory(a.id)
      setHistoryRows(Array.isArray(rows) ? rows : [])
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load history')
    } finally {
      setHistoryLoading(false)
    }
  }

  function closeHistory() {
    setHistoryArticle(null)
    setHistoryRows([])
    setHistoryError(null)
  }

  const canEdit = Boolean(session)

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Knowledge articles</h1>
          <p className={styles.sub}>
            Filters (status, tag, creator, updated date range) call the REST API. Search refines
            results in the browser. Status changes are recorded as a Draft → Reviewed → Published
            history for each article.
          </p>
        </div>

        <div className={styles.toolbarRow}>
          <div className={styles.search}>
            <label htmlFor="viewer-search">Search</label>
            <input
              id="viewer-search"
              type="search"
              placeholder="Title, summary, content, tags, creator…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className={styles.filter}>
            <label htmlFor="viewer-status">Status</label>
            <select
              id="viewer-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="Draft">Draft</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Published">Published</option>
            </select>
          </div>
          <div className={styles.filter}>
            <label htmlFor="viewer-tag">Tag</label>
            <select
              id="viewer-tag"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filter}>
            <label htmlFor="viewer-creator">Creator</label>
            <select
              id="viewer-creator"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
            >
              <option value="">All creators</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.username} ({u.role})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.filter}>
            <label htmlFor="viewer-from">Updated from</label>
            <input
              id="viewer-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className={styles.filter}>
            <label htmlFor="viewer-to">Updated to</label>
            <input
              id="viewer-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button className={styles.btn} type="button" onClick={() => loadArticles()}>
            Refresh
          </button>
        </div>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className={styles.muted}>Loading articles…</p> : null}

      {!loading && filtered.length === 0 ? (
        <p className={styles.muted}>No articles match your filters.</p>
      ) : null}

      {!loading && filtered.length > 0 ? (
        <div className={styles.grid}>
          {filtered.map((a) => {
            const advance = nextStatus(a.status)
            const advanceLabel = nextLabel(a.status)
            return (
              <article key={a.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.cardTitle}>{a.title}</h2>
                  <span className={`${styles.pill} ${statusClass(a.status)}`}>{a.status}</span>
                </div>
                {a.summary ? <p className={styles.summary}>{a.summary}</p> : null}
                {Array.isArray(a.tags) && a.tags.length > 0 ? (
                  <p className={styles.tagRow}>
                    {a.tags.map((name) => (
                      <span key={name} className={styles.tagChip}>
                        {name}
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className={styles.meta}>
                  #{a.id} ·{' '}
                  {a.creator_username != null ? (
                    <>
                      creator <strong>{a.creator_username}</strong> ·{' '}
                    </>
                  ) : null}
                  updated {a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}
                </p>
                <div className={styles.actions}>
                  <button type="button" className={styles.action} onClick={() => openHistory(a)}>
                    Status history
                  </button>
                  {canEdit && advance ? (
                    <button
                      type="button"
                      className={styles.action}
                      disabled={busyId === a.id}
                      onClick={() => onAdvance(a)}
                    >
                      {busyId === a.id ? 'Saving…' : advanceLabel}
                    </button>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      className={`${styles.action} ${styles.danger}`}
                      disabled={busyId === a.id}
                      onClick={() => onDelete(a)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {!session ? (
        <p className={styles.muted} style={{ marginTop: '1.25rem' }}>
          Sign in to advance status or delete. Anyone can open <strong>Status history</strong>.
        </p>
      ) : null}

      {historyArticle ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeHistory()
          }}
        >
          <div className={styles.modal} role="dialog" aria-labelledby="hist-title">
            <div className={styles.modalHead}>
              <h2 id="hist-title">Status history</h2>
              <button type="button" className={styles.modalClose} onClick={closeHistory}>
                Close
              </button>
            </div>
            <p className={styles.modalSub}>
              Article #{historyArticle.id} — {historyArticle.title}
            </p>
            {historyLoading ? <p className={styles.muted}>Loading…</p> : null}
            {historyError ? (
              <p className={styles.error} role="alert">
                {historyError}
              </p>
            ) : null}
            {!historyLoading && !historyError && historyRows.length === 0 ? (
              <p className={styles.muted}>No history rows yet. Run DB migration 002 if this persists.</p>
            ) : null}
            {!historyLoading && historyRows.length > 0 ? (
              <ol className={styles.historyList}>
                {historyRows.map((h) => (
                  <li key={h.id}>{formatHistoryRow(h)}</li>
                ))}
              </ol>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
