import { API_BASE_URL } from '@/config/constants'
import { get } from '@/lib/api'
import { getStoredLocale } from '@/lib/i18n'
import type {
  LeaderboardEntry,
  LeaderboardPlayerProfile,
  LeaderboardSearchResult,
  LeaderboardSummary,
  LeaderboardVersion,
} from '@/lib/types'

export type LeaderboardListPayload = LeaderboardVersion & { items: LeaderboardSummary[] }
export type LeaderboardDetailPayload = LeaderboardVersion & {
  leaderboard: LeaderboardSummary
  entries?: LeaderboardEntry[]
  items?: LeaderboardEntry[]
  limit: number
  offset: number
}
export type LeaderboardSearchPayload = LeaderboardVersion & { results: LeaderboardSearchResult[] }

async function gunzip(buffer: ArrayBuffer) {
  if (!('DecompressionStream' in window)) {
    throw new Error('当前浏览器不支持 gzip 二进制解压')
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

async function getBinary<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: {
      Accept: 'application/octet-stream',
      'Accept-Language': getStoredLocale() === 'en' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9',
    },
  })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      if (payload && typeof payload === 'object' && 'error' in payload) {
        message = String((payload as { error: unknown }).error)
      }
    } catch {
      // Keep the HTTP status fallback.
    }
    throw new Error(message)
  }

  const buffer = await response.arrayBuffer()
  const text = response.headers.get('X-Content-Encoding') === 'gzip'
    ? await gunzip(buffer)
    : new TextDecoder().decode(buffer)
  return JSON.parse(text) as T
}

export function getLeaderboardVersion(signal?: AbortSignal) {
  return get<LeaderboardVersion>('/api/leaderboards/version', undefined, { signal })
}

export function getLeaderboardListBinary(signal?: AbortSignal) {
  return getBinary<LeaderboardListPayload>('/api/leaderboards/data.bin', signal)
}

export function getLeaderboardDetailBinary(leaderboardId: string, limit: number, offset: number, signal?: AbortSignal) {
  return getBinary<LeaderboardDetailPayload>(
    `/api/leaderboards/${encodeURIComponent(leaderboardId)}/data.bin?limit=${limit}&offset=${offset}`,
    signal,
  )
}

export function searchLeaderboardsBinary(query: string, limit = 80, signal?: AbortSignal) {
  return getBinary<LeaderboardSearchPayload>(
    `/api/leaderboards/search.bin?query=${encodeURIComponent(query)}&limit=${limit}`,
    signal,
  )
}

export function getLeaderboardPlayerProfile(playerName: string, signal?: AbortSignal) {
  return get<LeaderboardPlayerProfile>(`/api/leaderboards/players/${encodeURIComponent(playerName)}`, undefined, { signal })
}
