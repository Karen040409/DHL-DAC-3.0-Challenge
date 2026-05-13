import pool from '../db/pool.js'

/** @param {unknown} body */
export function parseTagNames(body) {
  const raw = body?.tags ?? body?.tag_list
  if (raw == null || raw === '') return []
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean).slice(0, 24)
  }
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 24)
}

/** @param {import('mysql2/promise').PoolConnection} conn */
export async function linkTagsToArticle(conn, articleId, names) {
  for (const name of names) {
    if (name.length > 120) continue
    await conn.query('INSERT IGNORE INTO tags (name) VALUES (?)', [name])
    const [rows] = await conn.query('SELECT id FROM tags WHERE name = ? LIMIT 1', [name])
    const tagId = rows[0]?.id
    if (tagId == null) continue
    await conn.query('INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)', [
      articleId,
      tagId,
    ])
  }
}

/** @param {number[]} articleIds */
export async function tagsByArticleId(articleIds) {
  const map = new Map()
  if (!articleIds.length) return map
  const placeholders = articleIds.map(() => '?').join(',')
  const [tagRows] = await pool.query(
    `SELECT at.article_id, t.name
     FROM article_tags at
     INNER JOIN tags t ON t.id = at.tag_id
     WHERE at.article_id IN (${placeholders})
     ORDER BY t.name`,
    articleIds,
  )
  for (const r of tagRows) {
    const id = r.article_id
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(r.name)
  }
  return map
}

/** @param {Record<string, unknown>[]} rows */
export async function attachTagsToRows(rows) {
  const ids = rows.map((r) => r.id)
  const tagMap = await tagsByArticleId(ids)
  return rows.map((r) => ({
    ...r,
    tags: tagMap.get(r.id) ?? [],
  }))
}
