import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteArticle,
  fetchArticles,
  fetchTags,
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

export default function Viewer() {
  const session = getSession()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const [articles, setArticles] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const loadArticles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchArticles({
        status: statusFilter || undefined,
        tag: tagFilter || undefined,
      })
      setArticles(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load articles')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, tagFilter])

  useEffect(() => {
    const ac = new AbortController()
    fetchTags(ac.signal)
      .then(setTags)
      .catch(() => setTags([]))
    return () => ac.abort()
  }, [])

  useEffect(() => {
    loadArticles()
  }, [loadArticles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return articles
    return articles.filter((a) => {
      const hay = `${a.title ?? ''} ${a.summary ?? ''} ${a.content ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [articles, search])

  async function onAdvance(a) {
    const n = nextStatus(a.status)
    if (!n) return
    setBusyId(a.id)
    setError(null)
    try {
      const updated = await updateArticleStatus(a.id, n)
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

  const canEdit = Boolean(session)

  return (
    <div className={styles.page}>
      <header className={styles.toolbar}>
        <div>
          <h1 className={styles.title}>Knowledge articles</h1>
          <p className={styles.sub}>
            Live data from your Express API. Text search runs in the browser; status and tag
            filters are sent as query parameters. Editors can advance Draft to Reviewed to
            Published.
          </p>
        </div>

        <div className={styles.toolbarRow}>
          <div className={styles.search}>
            <label htmlFor="viewer-search">Search</label>
            <input
              id="viewer-search"
              type="search"
              placeholder="Filter by title, summary, or content…"
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
                <p className={styles.meta}>
                  #{a.id} · updated{' '}
                  {a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}
                </p>
                <div className={styles.actions}>
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
          Sign in to enable status transitions and delete actions.
        </p>
      ) : null}
    </div>
  )
}
