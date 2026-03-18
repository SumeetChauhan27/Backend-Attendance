/**
 * In-memory cache for student face embeddings.
 *
 * Loads all student embeddings from Google Sheets once on startup,
 * then refreshes periodically so new enrollments are picked up
 * without a restart.
 */

import { getRows } from './googleSheets.js'

const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let cache = []      // Array of { studentId, descriptor: number[128] }
let lastRefresh = 0
let refreshTimer = null

/**
 * Load (or reload) embeddings from the Students sheet.
 */
export const refreshCache = async () => {
  try {
    const rows = await getRows('Students')

    cache = rows
      .filter((row) => {
        if (!row.faceEmbedding) return false
        try {
          const parsed = typeof row.faceEmbedding === 'string'
            ? JSON.parse(row.faceEmbedding)
            : row.faceEmbedding
          if (!Array.isArray(parsed) || parsed.length === 0) return false
          
          // Old format [0.1, 0.2, ...] -> length 128
          if (typeof parsed[0] === 'number') {
            return parsed.length === 128
          }
          
          // New format [[0.1, ...], [0.1, ...]] -> length N (N >= 1) each 128
          return Array.isArray(parsed[0]) && parsed[0].length === 128
        } catch {
          return false
        }
      })
      .map((row) => {
        const parsed = typeof row.faceEmbedding === 'string'
          ? JSON.parse(row.faceEmbedding)
          : row.faceEmbedding
          
        let embeddings = []
        if (typeof parsed[0] === 'number') {
          embeddings = [parsed.map(Number)] // migrate single to array of 1
        } else {
          embeddings = parsed.map(desc => desc.map(Number))
        }

        return {
          studentId: row.id,
          name: row.name || '',
          embeddings,
        }
      })

    lastRefresh = Date.now()
    console.log(`Embeddings cache loaded: ${cache.length} students with face data`)
  } catch (err) {
    console.error('Failed to refresh embedding cache:', err.message)
  }
}

/**
 * Start the periodic cache refresh.  Call once during app init.
 */
export const startCacheRefresh = () => {
  if (refreshTimer) return
  refreshTimer = setInterval(() => {
    void refreshCache()
  }, REFRESH_INTERVAL_MS)
}

/**
 * Get all cached embeddings.
 * @returns {{ studentId: string, name: string, descriptor: number[] }[]}
 */
export const getEmbeddings = () => cache

/**
 * Timestamp of the last successful cache refresh.
 */
export const getLastRefreshTime = () => lastRefresh
