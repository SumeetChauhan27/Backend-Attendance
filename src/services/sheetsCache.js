/**
 * Generic TTL-based in-memory cache for Google Sheets tab data.
 *
 * - getRows() results are cached per tab for TTL_MS milliseconds.
 * - Any write (appendRow / updateRow / deleteRow / setAllRows) must call
 *   invalidateCache(tabName) so the next read fetches fresh data.
 */

const TTL_MS = 30 * 1000 // 30 seconds

const store = new Map() // tabName -> { data, expiresAt }

/**
 * Get cached data for a tab, or null if missing/expired.
 * @param {string} tabName
 * @returns {Array|null}
 */
export const getCached = (tabName) => {
  const entry = store.get(tabName)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(tabName)
    return null
  }
  return entry.data
}

/**
 * Store data in the cache for a tab.
 * @param {string} tabName
 * @param {Array} data
 */
export const setCache = (tabName, data) => {
  store.set(tabName, { data, expiresAt: Date.now() + TTL_MS })
}

/**
 * Invalidate (clear) the cache for a specific tab.
 * Call this after any write operation on that tab.
 * @param {string} tabName
 */
export const invalidateCache = (tabName) => {
  store.delete(tabName)
}

/**
 * Invalidate all cached tabs at once.
 */
export const invalidateAll = () => {
  store.clear()
}
