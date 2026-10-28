import { useEffect, useState } from 'react'
import { get } from '@/lib/api'
import { useI18n } from '@/lib/i18n-react'
import type { LeaderboardEntry, LeaderboardSummary } from '@/lib/types'

export function GenericLeaderboardView() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [boards, setBoards] = useState<LeaderboardSummary[]>([])
  const [selected, setSelected] = useState('')
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [offset, setOffset] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    get<LeaderboardSummary[]>('/api/leaderboards', undefined, { signal: controller.signal }).then(result => { setBoards(result); setSelected(result[0]?.leaderboard_id || '') }).catch(err => { if (!controller.signal.aborted) setError(String(err.message || err)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (!selected) { setRows([]); return }
    const controller = new AbortController()
    get<{ items: LeaderboardEntry[] }>(`/api/leaderboards/${encodeURIComponent(selected)}?limit=100&offset=${offset}`, undefined, { signal: controller.signal }).then(result => { setRows(result.items ?? []); setError('') }).catch(err => { if (!controller.signal.aborted) setError(String(err.message || err)) })
    return () => controller.abort()
  }, [selected, offset])
  const current = boards.find(board => board.leaderboard_id === selected)
  return <section className="main-stack readable">
    <div className="panel doc-panel"><h1>{en ? 'Leaderboards' : '排行榜'}</h1>
      {error && <p role="alert">{error}</p>}
      {loading ? <p>{en ? 'Loading…' : '加载中…'}</p> : boards.length === 0 ? <p>{en ? 'No leaderboard data has been imported.' : '尚未导入排行榜数据。'}</p> : <>
        <label>{en ? 'Leaderboard' : '选择榜单'}<select value={selected} onChange={e => { setSelected(e.target.value); setOffset(0) }}>{boards.map(board => <option key={board.leaderboard_id} value={board.leaderboard_id}>{board.leaderboard_name || board.leaderboard_key || board.leaderboard_type || board.leaderboard_id}</option>)}</select></label>
        <table><thead><tr><th>{en ? 'Rank' : '排名'}</th><th>{en ? 'Player' : '玩家'}</th><th>{en ? 'Score' : '分数'}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.entry_index}-${index}`}><td>{row.rank}</td><td>{row.player_name}</td><td>{row.score}</td></tr>)}</tbody></table>
        <div className="row-actions"><button disabled={offset === 0} onClick={() => setOffset(x => Math.max(0, x - 100))}>{en ? 'Previous' : '上一页'}</button><button disabled={offset + 100 >= (current?.entry_count ?? 0)} onClick={() => setOffset(x => x + 100)}>{en ? 'Next' : '下一页'}</button></div>
      </>}
    </div>
  </section>
}
