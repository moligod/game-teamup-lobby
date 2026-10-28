import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import {
  getLeaderboardDetailBinary,
  getLeaderboardListBinary,
  getLeaderboardPlayerProfile,
  getLeaderboardVersion,
  searchLeaderboardsBinary,
} from '../api/leaderboard-api'
import { readLeaderboardCache, writeLeaderboardCache } from '../api/leaderboard-cache'
import { useLeaderboardRealtime } from '../hooks/use-leaderboard-realtime'
import { PlayerProfileDrawer } from './PlayerProfileDrawer'
import { displayLeaderboardName, formatDate, formatNumber, formatScore, getErrorMessage, isAbortError } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import { EmptyState } from '@/shared/ui/EmptyState'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'
import type { LeaderboardEntry, LeaderboardPlayerProfile, LeaderboardSearchResult, LeaderboardSummary } from '@/lib/types'

const pageSize = 100
const defaultLeaderboardId = '1'

type BoardCategoryId = '3' | '4' | '5' | '6' | '8' | '9' | '10' | 'other'

type BoardWithCategory = LeaderboardSummary & {
  category: BoardCategoryId
}

const categories: { id: BoardCategoryId; labelKey: string }[] = [
  { id: '4', labelKey: 'leaderboard.mastery' },
  { id: '5', labelKey: 'leaderboard.stats' },
  { id: '6', labelKey: 'leaderboard.power' },
  { id: '8', labelKey: 'leaderboard.delve' },
  { id: '9', labelKey: 'leaderboard.classActivity' },
  { id: '10', labelKey: 'leaderboard.paragon' },
  { id: '3', labelKey: 'leaderboard.weekly' },
  { id: 'other', labelKey: 'leaderboard.other' },
]

const groupedCategories = categories

const categoryLabelKeys: Record<BoardCategoryId, string> = {
  '3': 'leaderboard.weekly',
  '4': 'leaderboard.mastery',
  '5': 'leaderboard.stats',
  '6': 'leaderboard.power',
  '8': 'leaderboard.delve',
  '9': 'leaderboard.classActivity',
  '10': 'leaderboard.paragon',
  other: 'leaderboard.other',
}

function classifyLeaderboard(board: LeaderboardSummary): BoardCategoryId {
  const categoryId = String(board.category_id ?? '').trim()
  if (categoryId === '3' || categoryId === '4' || categoryId === '5' || categoryId === '6' || categoryId === '8' || categoryId === '9' || categoryId === '10') {
    return categoryId
  }
  return 'other'
}

function createCategoryCounts() {
  return {
    '3': 0,
    '4': 0,
    '5': 0,
    '6': 0,
    '8': 0,
    '9': 0,
    '10': 0,
    other: 0,
  } satisfies Record<BoardCategoryId, number>
}

function getDefaultLeaderboard(list: LeaderboardSummary[]) {
  return list.find((item) => item.leaderboard_id === defaultLeaderboardId) ?? list[0] ?? null
}

export function LeaderboardView() {
  const { t } = useI18n()
  const [leaderboards, setLeaderboards] = useState<LeaderboardSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<BoardCategoryId>('4')
  const [expandedCategories, setExpandedCategories] = useState<Set<BoardCategoryId>>(() => new Set(['4']))
  const [searchResults, setSearchResults] = useState<LeaderboardSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leaderboardHash, setLeaderboardHash] = useState<string | null>(null)
  const [playerProfile, setPlayerProfile] = useState<LeaderboardPlayerProfile | null>(null)
  const [playerProfileOpen, setPlayerProfileOpen] = useState(false)
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false)
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null)
  const playerProfileRequestId = useRef(0)
  const listRequestController = useRef<AbortController | null>(null)
  const entriesRequestController = useRef<AbortController | null>(null)
  const searchRequestController = useRef<AbortController | null>(null)
  const playerProfileRequestController = useRef<AbortController | null>(null)
  const pendingLoads = useRef(0)

  const beginLoading = useCallback(() => {
    pendingLoads.current += 1
    setLoading(true)
  }, [])

  const finishLoading = useCallback(() => {
    pendingLoads.current = Math.max(0, pendingLoads.current - 1)
    if (pendingLoads.current === 0) setLoading(false)
  }, [])

  const boardsWithCategory = useMemo<BoardWithCategory[]>(
    () => leaderboards.map((item) => ({ ...item, category: classifyLeaderboard(item) })),
    [leaderboards],
  )

  const categoryCounts = useMemo(() => {
    const counts = createCategoryCounts()
    boardsWithCategory.forEach((item) => {
      counts[item.category] += 1
    })
    return counts
  }, [boardsWithCategory])

  const filteredBoards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return boardsWithCategory.filter((item) => {
      const name = displayLeaderboardName(item.leaderboard_name, item.leaderboard_type, item.leaderboard_key)
      const categoryMatched = item.category === activeCategory
      const queryMatched =
        !normalizedQuery ||
        name.toLowerCase().includes(normalizedQuery) ||
        item.leaderboard_id.includes(normalizedQuery) ||
        String(item.leaderboard_key ?? '').toLowerCase().includes(normalizedQuery)
      return categoryMatched && queryMatched
    })
  }, [activeCategory, boardsWithCategory, query])

  const boardsByCategory = useMemo(() => {
    const grouped = new Map<BoardCategoryId, BoardWithCategory[]>()
    groupedCategories.forEach((category) => grouped.set(category.id, []))
    filteredBoards.forEach((board) => {
      grouped.get(board.category)?.push(board)
    })
    return grouped
  }, [filteredBoards])

  const playerSearchResults = useMemo(
    () => searchResults.filter((item) => item.player_name),
    [searchResults],
  )

  const selected = useMemo(
    () => boardsWithCategory.find((item) => item.leaderboard_id === selectedId) ?? null,
    [boardsWithCategory, selectedId],
  )

  const loadList = useCallback(async () => {
    listRequestController.current?.abort()
    const controller = new AbortController()
    listRequestController.current = controller
    beginLoading()
    setError(null)
    try {
      const version = await getLeaderboardVersion(controller.signal)
      if (controller.signal.aborted) return
      setLeaderboardHash(version.hash)
      const cached = readLeaderboardCache<LeaderboardSummary[]>('list', version.hash)
      const payload = cached ? null : await getLeaderboardListBinary(controller.signal)
      if (controller.signal.aborted) return
      const list = cached ?? payload?.items ?? []
      if (!cached) {
        const nextHash = payload?.hash || version.hash
        setLeaderboardHash(nextHash)
        writeLeaderboardCache('list', nextHash, list)
      }
      setLeaderboards(list)
      setSelectedId((current) => {
        if (current && list.some((item) => item.leaderboard_id === current)) return current
        return getDefaultLeaderboard(list)?.leaderboard_id ?? null
      })
    } catch (err) {
      if (!isAbortError(err)) setError(getErrorMessage(err))
    } finally {
      if (listRequestController.current === controller) {
        listRequestController.current = null
      }
      finishLoading()
    }
  }, [beginLoading, finishLoading])

  const loadEntries = useCallback(async () => {
    entriesRequestController.current?.abort()
    if (!selected) {
      setEntries([])
      return
    }
    const controller = new AbortController()
    entriesRequestController.current = controller
    beginLoading()
    setError(null)
    try {
      const version = leaderboardHash ? { hash: leaderboardHash } : await getLeaderboardVersion(controller.signal)
      if (controller.signal.aborted) return
      if (!leaderboardHash) setLeaderboardHash(version.hash)
      const cacheKey = `detail:${selected.leaderboard_id}:${pageSize}:${offset}`
      const cached = readLeaderboardCache<LeaderboardEntry[]>(cacheKey, version.hash)
      if (cached) {
        setEntries(cached)
        return
      }

      const detail = await getLeaderboardDetailBinary(selected.leaderboard_id, pageSize, offset, controller.signal)
      if (controller.signal.aborted) return
      const nextEntries = detail.entries ?? detail.items ?? []
      setLeaderboardHash(detail.hash || version.hash)
      setEntries(nextEntries)
      writeLeaderboardCache(cacheKey, detail.hash || version.hash, nextEntries)
    } catch (err) {
      if (!isAbortError(err)) setError(getErrorMessage(err))
    } finally {
      if (entriesRequestController.current === controller) {
        entriesRequestController.current = null
      }
      finishLoading()
    }
  }, [beginLoading, finishLoading, leaderboardHash, offset, selected])

  const chooseBoard = useCallback((leaderboardId: string) => {
    setSelectedId(leaderboardId)
    setOffset(0)
  }, [])

  const closePlayerProfile = useCallback(() => {
    playerProfileRequestId.current += 1
    playerProfileRequestController.current?.abort()
    playerProfileRequestController.current = null
    setPlayerProfileOpen(false)
    setPlayerProfileLoading(false)
    setPlayerProfileError(null)
    setPlayerProfile(null)
  }, [])

  const openPlayerProfile = useCallback(async (playerName: string) => {
    playerProfileRequestController.current?.abort()
    const controller = new AbortController()
    playerProfileRequestController.current = controller
    const requestId = playerProfileRequestId.current + 1
    playerProfileRequestId.current = requestId
    setPlayerProfileOpen(true)
    setPlayerProfileLoading(true)
    setPlayerProfileError(null)
    setPlayerProfile(null)
    try {
      const profile = await getLeaderboardPlayerProfile(playerName, controller.signal)
      if (playerProfileRequestId.current === requestId) setPlayerProfile(profile)
    } catch (err) {
      if (playerProfileRequestId.current === requestId && !isAbortError(err)) setPlayerProfileError(getErrorMessage(err))
    } finally {
      if (playerProfileRequestController.current === controller) {
        playerProfileRequestController.current = null
      }
      if (playerProfileRequestId.current === requestId && !controller.signal.aborted) setPlayerProfileLoading(false)
    }
  }, [])

  const selectBoardFromPlayerProfile = useCallback((leaderboardId: string) => {
    chooseBoard(leaderboardId)
    closePlayerProfile()
  }, [chooseBoard, closePlayerProfile])

  const toggleCategory = useCallback((categoryId: BoardCategoryId) => {
    setExpandedCategories((current) => {
      const next = new Set(current)
      if (next.has(categoryId)) {
        next.delete(categoryId)
      } else {
        next.add(categoryId)
      }
      return next
    })
  }, [])

  useEffect(() => {
    void loadList()
    return () => {
      listRequestController.current?.abort()
      listRequestController.current = null
    }
  }, [loadList])

  useEffect(() => {
    if (filteredBoards.length === 0) {
      if (selectedId !== null) {
        setSelectedId(null)
        setOffset(0)
      }
      return
    }
    if (!filteredBoards.some((item) => item.leaderboard_id === selectedId)) {
      setSelectedId(getDefaultLeaderboard(filteredBoards)?.leaderboard_id ?? null)
      setOffset(0)
    }
  }, [filteredBoards, selectedId])

  useEffect(() => {
    void loadEntries()
    return () => {
      entriesRequestController.current?.abort()
      entriesRequestController.current = null
    }
  }, [loadEntries])

  useEffect(() => {
    searchRequestController.current?.abort()
    searchRequestController.current = null
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    const controller = new AbortController()
    searchRequestController.current = controller
    setSearchLoading(true)
    const timer = window.setTimeout(() => {
      searchLeaderboardsBinary(trimmedQuery, 80, controller.signal)
        .then((payload) => {
          if (controller.signal.aborted) return
          if (payload.hash) setLeaderboardHash(payload.hash)
          setSearchResults(payload.results ?? [])
        })
        .catch((err) => {
          if (!isAbortError(err)) setError(getErrorMessage(err))
        })
        .finally(() => {
          if (searchRequestController.current === controller) {
            searchRequestController.current = null
            if (!controller.signal.aborted) setSearchLoading(false)
          }
        })
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
      if (searchRequestController.current === controller) {
        searchRequestController.current = null
      }
    }
  }, [query])

  useEffect(() => () => {
    playerProfileRequestId.current += 1
    playerProfileRequestController.current?.abort()
    playerProfileRequestController.current = null
  }, [])

  const handleLeaderboardUpdate = useCallback(() => {
    setLeaderboardHash(null)
    closePlayerProfile()
    loadList()
  }, [closePlayerProfile, loadList])

  useLeaderboardRealtime(handleLeaderboardUpdate)

  return (
    <>
      <section className="leaderboard-layout">
      <Panel as="aside" className="leaderboard-nav">
        <div className="section-head">
          <h1>{t('leaderboard.title')}</h1>
        </div>
        <label className="search-box">
          <Search size={16} />
          <input maxLength={120} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('leaderboard.searchPlaceholder')} />
        </label>
        {query.trim() ? (
          <div className="player-search-list">
            <div className="board-group-head static">
              <span>{t('leaderboard.player')}</span>
              <em>{searchLoading ? '...' : formatNumber(playerSearchResults.length)}</em>
            </div>
            {playerSearchResults.slice(0, 12).map((item) => (
              <button
                key={`${item.leaderboard_id}-${item.entry_index}-${item.player_name}`}
                className="board-item"
                onClick={() => void openPlayerProfile(item.player_name ?? '')}
                type="button"
              >
                <strong>{item.player_name}</strong>
                <span className="board-meta">
                  <em>#{item.rank}</em>
                  <span>{displayLeaderboardName(item.leaderboard_name, item.leaderboard_type, item.leaderboard_key)}</span>
                  <span>{formatScore(String(item.score ?? ''))}</span>
                </span>
              </button>
            ))}
            {!searchLoading && playerSearchResults.length === 0 ? <p className="player-search-empty">{t('leaderboard.playerNotIndexed', undefined, '\u8be5\u73a9\u5bb6\u6682\u672a\u6536\u5f55\uff0c\u8bf7\u7b49\u5f85\u4e0b\u6b21\u6570\u636e\u66f4\u65b0\u3002')}</p> : null}
          </div>
        ) : null}
        <div className="leaderboard-tree">
          {groupedCategories.map((category) => {
            const isExpanded = expandedCategories.has(category.id)
            const categoryBoards = boardsByCategory.get(category.id) ?? []
            return (
              <div className="board-group" key={category.id}>
                <div className={activeCategory === category.id ? 'board-group-head active' : 'board-group-head'}>
                  <button
                    className="board-group-select"
                    onClick={() => {
                      setActiveCategory(category.id)
                      setOffset(0)
                      toggleCategory(category.id)
                    }}
                    type="button"
                  >
                    <span>{t(category.labelKey)}</span>
                    <em>{formatNumber(categoryCounts[category.id])}</em>
                  </button>
                </div>
                {isExpanded ? (
                  <div className="board-list">
                    {categoryBoards.map((item) => {
                      const active = selected?.leaderboard_id === item.leaderboard_id
                      return (
                        <button
                          key={item.leaderboard_id}
                          className={active ? 'board-item active' : 'board-item'}
                          onClick={() => chooseBoard(item.leaderboard_id)}
                          type="button"
                        >
                          <strong>{displayLeaderboardName(item.leaderboard_name, item.leaderboard_type, item.leaderboard_key)}</strong>
                          <span className="board-meta">
                            <span>
                              #{item.leaderboard_id} - {t('leaderboard.rowCount', { count: formatNumber(item.entry_count) })}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
          {!loading && filteredBoards.length === 0 && playerSearchResults.length === 0 ? <div className="board-empty">{t('leaderboard.noMatch')}</div> : null}
        </div>
      </Panel>

      <div className="main-stack">
        {error ? <Notice variant="error">{error}</Notice> : null}
        <Panel as="div" className="table-panel">
          <div className="section-head">
            <div>
              <h2>
                {selected
                  ? displayLeaderboardName(selected.leaderboard_name, selected.leaderboard_type, selected.leaderboard_key)
                  : t('leaderboard.noBoard')}
              </h2>
              <p className="muted">
                {selected
                  ? `${t(categoryLabelKeys[selected.category])} · ID ${selected.leaderboard_id} · ${t('leaderboard.rowCount', { count: formatNumber(selected.entry_count) })} · ${formatDate(selected.updated_at)}`
                  : t('leaderboard.waitingUpload')}
              </p>
            </div>
            <div className="row-actions">
              <IconButton label={t('leaderboard.previousPage')} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton
                label={t('leaderboard.nextPage')}
                disabled={!selected || offset + pageSize >= (selected.entry_count ?? 0)}
                onClick={() => setOffset(offset + pageSize)}
              >
                <ChevronRight size={18} />
              </IconButton>
            </div>
          </div>

          <div className="data-table">
            <div className="table-row table-head">
              <span>{t('leaderboard.rank')}</span>
              <span>{t('leaderboard.player')}</span>
              <span>{t('leaderboard.value')}</span>
            </div>
            {entries.map((entry) => {
              const masteryLevel = entry.mastery_level_text?.trim() || null
              return (
                <div className="table-row" key={`${entry.entry_index}-${entry.rank}-${entry.player_name}`}>
                  <span>#{entry.rank}</span>
                  <button className="player-link" onClick={() => void openPlayerProfile(entry.player_name)} type="button">
                    {entry.player_name}
                  </button>
                  <span className="score-cell">
                    <span>{formatScore(entry.score)}</span>
                    {masteryLevel ? <em>{masteryLevel}</em> : null}
                  </span>
                </div>
              )
            })}
          </div>
          {loading ? <EmptyState>{t('common.loading')}</EmptyState> : null}
          {!loading && entries.length === 0 ? <EmptyState>{t('common.no_data')}</EmptyState> : null}
        </Panel>
      </div>
      </section>
      {playerProfileOpen ? (
        <PlayerProfileDrawer
          error={playerProfileError}
          loading={playerProfileLoading}
          onClose={closePlayerProfile}
          onSelectBoard={selectBoardFromPlayerProfile}
          profile={playerProfile}
        />
      ) : null}
    </>
  )
}
