const SESSION_KEY = 'smarthub_session'

/**
 * @typedef {{ userId: number, username: string, role: 'admin' | 'editor' }} Session
 */

/** @returns {Session | null} */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (
      typeof data?.userId === 'number' &&
      typeof data?.username === 'string' &&
      (data.role === 'admin' || data.role === 'editor')
    ) {
      return data
    }
    return null
  } catch {
    return null
  }
}

/** @param {Session} session */
export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
