import { useCallback, useEffect, useMemo, useState } from 'react'

const STATUS_OPTIONS = ['', 'Draft', 'Reviewed', 'Published']

function buildQuery(status, tag) {
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  if (tag.trim()) q.set('tag', tag.trim())
  const s = q.toString()
  return s ? `?${s}` : ''
}

export default function ViewerPage() {
  const [status, setStatus] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [debouncedTag, setDebouncedTag] = useState('')

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedTag(tagInput), 450)
    return () => window.clearTimeout(id)
  }, [tagInput])

  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const queryString = useMemo(
    () => buildQuery(status, debouncedTag),
    [status, debouncedTag],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/articles${queryString}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Request failed (${res.status})`)
      }
      const data = await res.json()
      setArticles(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load articles')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => {
    load()
  }, [load])

  return (
    <section className="page">
      <h1>Article viewer</h1>
      <p className="page-lead">
        Dashboard to browse knowledge articles. Data is loaded from the REST API (no
        hardcoded lists). Use filters for status and tag; date sorting follows{' '}
        <code>updated_at</code> from the server.
      </p>

      <div className="card filters">
        <label className="field inline">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </label>
        <label className="field inline grow">
          <span>Tag</span>
          <input
            type="search"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Filter by tag name"
          />
        </label>
        <button type="button" className="btn-secondary" onClick={() => load()}>
          Refresh
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && articles.length === 0 && (
        <p className="muted">No articles match the filters. Create drafts via the API.</p>
      )}

      {!loading && articles.length > 0 && (
        <ul className="article-list">
          {articles.map((a) => (
            <li key={a.id} className="article-card">
              <div className="article-card-head">
                <h2>{a.title}</h2>
                <span className={`pill status-${String(a.status).toLowerCase()}`}>
                  {a.status}
                </span>
              </div>
              {a.summary && <p className="article-summary">{a.summary}</p>}
              <p className="meta">
                Updated {a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'} ·
                Creator #{a.creator_id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
