import { useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { displayLeaderboardName, formatNumber, formatScore } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { LeaderboardPlayerProfile } from '@/lib/types'
import { EmptyState } from '@/shared/ui/EmptyState'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'

type PlayerProfileDrawerProps = {
  profile: LeaderboardPlayerProfile | null
  loading: boolean
  error: string | null
  onClose: () => void
  onSelectBoard?: (leaderboardId: string) => void
}

const categoryLabelKeys: Record<string, string> = {
  '3': 'leaderboard.weekly',
  '4': 'leaderboard.mastery',
  '5': 'leaderboard.stats',
  '6': 'leaderboard.power',
  '8': 'leaderboard.delve',
  '9': 'leaderboard.classActivity',
  '10': 'leaderboard.paragon',
  other: 'leaderboard.other',
}

const categoryOrder = new Map(Object.keys(categoryLabelKeys).map((categoryId, index) => [categoryId, index]))

export function PlayerProfileDrawer({ profile, loading, error, onClose, onSelectBoard }: PlayerProfileDrawerProps) {
  const { locale, t } = useI18n()
  const displayError = error?.trim().toLowerCase() === 'player not found'
    ? locale === 'zh' ? '\u6682\u672a\u627e\u5230\u8be5\u73a9\u5bb6\u6e38\u620f\u4fe1\u606f' : 'Player game information was not found'
    : error

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const groupedItems = useMemo(() => {
    const groups = new Map<string, LeaderboardPlayerProfile['items']>()
    for (const item of profile?.items ?? []) {
      const categoryId = String(item.category_id ?? 'other')
      const group = groups.get(categoryId) ?? []
      group.push(item)
      groups.set(categoryId, group)
    }
    return Array.from(groups, ([categoryId, items]) => ({ categoryId, items }))
      .sort((left, right) => (categoryOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER))
  }, [profile])

  return (
    <div className="player-profile-backdrop" onMouseDown={onClose}>
      <Panel
        as="aside"
        aria-label={profile?.player.display_name ?? t('leaderboard.player')}
        aria-modal="true"
        className="player-profile-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="section-head player-profile-head">
          <div>
            <h2>{profile?.player.display_name ?? t('leaderboard.player')}</h2>
            {profile ? <p className="muted">{formatNumber(profile.items.length)}</p> : null}
          </div>
          <IconButton label={t('common.close')} onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {displayError ? <Notice variant="error">{displayError}</Notice> : null}
        {loading ? <EmptyState>{t('common.loading')}</EmptyState> : null}
        {!loading && !error && groupedItems.length === 0 ? <EmptyState>{t('common.no_data')}</EmptyState> : null}
        {!loading && !error ? (
          <div className="player-profile-groups">
            {groupedItems.map(({ categoryId, items }) => (
              <section className="player-profile-group" key={categoryId}>
                <h3>{t(categoryLabelKeys[categoryId] ?? 'leaderboard.other')}</h3>
                <div className="player-profile-list">
                  {items.map((item) => (
                  onSelectBoard ? (
                    <button
                      className="player-profile-row"
                      key={item.leaderboard_id}
                      onClick={() => onSelectBoard(item.leaderboard_id)}
                      type="button"
                    >
                      <span className="player-profile-rank">#{item.rank}</span>
                      <strong>{displayLeaderboardName(item.leaderboard_name, item.leaderboard_type, item.leaderboard_key)}</strong>
                      <span className="score-cell">
                        <span>{formatScore(item.score)}</span>
                        {item.mastery_level_text?.trim() ? <em>{item.mastery_level_text}</em> : null}
                      </span>
                    </button>
                  ) : (
                    <div className="player-profile-row" key={item.leaderboard_id}>
                      <span className="player-profile-rank">#{item.rank}</span>
                      <strong>{displayLeaderboardName(item.leaderboard_name, item.leaderboard_type, item.leaderboard_key)}</strong>
                      <span className="score-cell">
                        <span>{formatScore(item.score)}</span>
                        {item.mastery_level_text?.trim() ? <em>{item.mastery_level_text}</em> : null}
                      </span>
                    </div>
                  )
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
