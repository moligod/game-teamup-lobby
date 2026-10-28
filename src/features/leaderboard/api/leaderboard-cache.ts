const CACHE_PREFIX = 'trovebbs:leaderboard:v1:'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CacheEnvelope<T> {
  hash: string
  expiresAt: number
  value: T
}

function cacheKey(key: string) {
  return `${CACHE_PREFIX}${key}`
}

function getStorage() {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readLeaderboardCache<T>(key: string, hash: string): T | null {
  const storage = getStorage()
  if (!storage) return null
  const fullKey = cacheKey(key)
  try {
    const raw = storage.getItem(fullKey)
    if (!raw) return null
    const envelope = JSON.parse(raw) as CacheEnvelope<T>
    if (envelope.hash !== hash || envelope.expiresAt <= Date.now()) {
      storage.removeItem(fullKey)
      return null
    }
    return envelope.value
  } catch {
    storage.removeItem(fullKey)
    return null
  }
}

export function writeLeaderboardCache<T>(key: string, hash: string, value: T) {
  const storage = getStorage()
  if (!storage) return
  try {
    const envelope: CacheEnvelope<T> = { hash, expiresAt: Date.now() + CACHE_TTL_MS, value }
    storage.setItem(cacheKey(key), JSON.stringify(envelope))
  } catch {
    // Large leaderboards may exceed quota; network loading remains the fallback.
  }
}

export function clearLeaderboardCache() {
  const storage = getStorage()
  if (!storage) return
  try {
    Object.keys(storage)
      .filter((key) => key.startsWith(CACHE_PREFIX))
      .forEach((key) => storage.removeItem(key))
  } catch {
    // Ignore storage access failures.
  }
}
