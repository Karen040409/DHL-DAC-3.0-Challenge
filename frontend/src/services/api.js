/**
 * Base URL for API calls. Leave empty in dev to use Vite proxy (`/api` → backend).
 * For production or cross-origin dev: `VITE_API_BASE_URL=http://localhost:3001`
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function parseError(res) {
  try {
    const body = await res.json()
    if (body?.error) return body.error
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed'
}

/**
 * @param {string} path - e.g. `/api/articles`
 * @param {RequestInit & { parseJson?: boolean }} [options]
 */
async function request(path, options = {}) {
  const { parseJson = true, headers, ...rest } = options
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: 'application/json',
      ...headers,
    },
  })

  if (res.status === 204) return null

  if (!res.ok) {
    throw new Error(await parseError(res))
  }

  if (!parseJson) return null
  const text = await res.text()
  if (!text) return null
  return JSON.parse(text)
}

/**
 * @param {{
 *   status?: string,
 *   tag?: string,
 *   creator_id?: string|number,
 *   updated_from?: string,
 *   updated_to?: string,
 *   signal?: AbortSignal
 * }} [params]
 */
export function fetchArticles(params = {}) {
  const { status, tag, creator_id, updated_from, updated_to, signal } = params
  const q = new URLSearchParams()
  if (status) q.set('status', status)
  if (tag) q.set('tag', tag)
  if (creator_id) q.set('creator_id', String(creator_id))
  if (updated_from) q.set('updated_from', updated_from)
  if (updated_to) q.set('updated_to', updated_to)
  const qs = q.toString()
  return request(`/api/articles${qs ? `?${qs}` : ''}`, { signal })
}

/**
 * @param {number|string} id
 * @param {AbortSignal} [signal]
 */
export function fetchArticle(id, signal) {
  return request(`/api/articles/${encodeURIComponent(String(id))}`, { signal })
}

/**
 * @param {number|string} id
 * @param {AbortSignal} [signal]
 */
export function fetchArticleHistory(id, signal) {
  return request(`/api/articles/${encodeURIComponent(String(id))}/history`, { signal })
}

/**
 * @param {AbortSignal} [signal]
 */
export function fetchUsers(signal) {
  return request('/api/users', { signal })
}

/**
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array<{ id: number, name: string }>>}
 */
export function fetchTags(signal) {
  return request('/api/tags', { signal })
}

/**
 * @param {{ title: string, summary?: string|null, content?: string|null, creator_id: number, tags?: string[] }} data
 */
export function createArticle(data) {
  return request('/api/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

/**
 * @param {number|string} id
 * @param {'Draft'|'Reviewed'|'Published'} status
 * @param {number|undefined} [actorUserId] — optional editor id for status history
 */
export function updateArticleStatus(id, status, actorUserId) {
  const body = { status }
  if (actorUserId != null && Number.isFinite(Number(actorUserId))) {
    body.actor_user_id = Number(actorUserId)
  }
  return request(`/api/articles/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * @param {number|string} id
 */
export async function deleteArticle(id) {
  await request(`/api/articles/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    parseJson: false,
  })
}

/**
 * Looks for Reviewed/Published articles with similar titles so the editor sees
 * potential conflicts before saving a new draft.
 * @param {string} title
 * @param {string} [tag]
 * @param {AbortSignal} [signal]
 */
export function findConflicts(title, tag, signal) {
  const q = new URLSearchParams()
  q.set('title', title)
  if (tag) q.set('tag', tag)
  return request(`/api/articles/conflicts?${q.toString()}`, { signal })
}

/**
 * @param {number|string} articleId
 * @param {File[]} files
 * @param {number} [uploadedBy]
 */
export async function uploadAttachments(articleId, files, uploadedBy) {
  if (!files || files.length === 0) return { uploaded: [], all: [] }
  const fd = new FormData()
  for (const f of files) fd.append('files', f, f.name)
  if (uploadedBy != null) fd.append('uploaded_by', String(uploadedBy))
  const url = `${API_BASE}/api/articles/${encodeURIComponent(String(articleId))}/attachments`
  const res = await fetch(url, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}

/**
 * @param {number|string} articleId
 * @param {AbortSignal} [signal]
 */
export function fetchAttachments(articleId, signal) {
  return request(
    `/api/articles/${encodeURIComponent(String(articleId))}/attachments`,
    { signal },
  )
}

/**
 * Build a download URL for an attachment (absolute when VITE_API_BASE_URL is set).
 * @param {number|string} articleId
 * @param {number|string} attachmentId
 */
export function attachmentDownloadUrl(articleId, attachmentId) {
  return `${API_BASE}/api/articles/${encodeURIComponent(String(articleId))}/attachments/${encodeURIComponent(String(attachmentId))}/download`
}

/**
 * Server-side login. Returns the real user row from MySQL (id, username, role)
 * so the SmartHub session reflects the authenticated user instead of a guess.
 * @param {string} username
 * @param {string} password
 */
export function loginRequest(username, password) {
  return request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

/**
 * Send a single PDF/DOCX/TXT to the server for text extraction.
 * Used by the Upload console to turn messy attachments into editable text
 * before saving the draft.
 * @param {File} file
 * @returns {Promise<{
 *   original_name: string,
 *   kind: 'pdf'|'docx'|'text',
 *   mime_type: string,
 *   size_bytes: number,
 *   content_hash: string,
 *   char_count: number,
 *   truncated: boolean,
 *   warning: string|null,
 *   text: string,
 * }>}
 */
export async function extractTextFromFile(file) {
  const fd = new FormData()
  fd.append('file', file, file.name)
  const res = await fetch(`${API_BASE}/api/extract`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error(await parseError(res))
  return res.json()
}
