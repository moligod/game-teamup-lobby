import { formatDate } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { Team } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

export function AdminMiniTable({ title, rows }: { title: string; rows: Array<Array<string | number>> }) {
  return (
    <div className="admin-mini-table">
      <h3>{title}</h3>
      {rows.length === 0 ? <EmptyState>{'\u6682\u65e0\u6570\u636e'}</EmptyState> : null}
      {rows.map((row, index) => (
        <div className="mini-item compact" key={`${title}-${index}`}>
          <strong>{row[0]}</strong>
          <span>{row.slice(1).join(' / ')}</span>
        </div>
      ))}
    </div>
  )
}

export function AdminTeamList({ title, teams, onStatusChange }: { title: string; teams: Team[]; onStatusChange: (team: Team) => Promise<void> }) {
  const { t } = useI18n()
  return (
    <div className="admin-mini-table">
      <h3>{title}</h3>
      {teams.length === 0 ? <EmptyState>{'\u6682\u65e0\u6570\u636e'}</EmptyState> : null}
      {teams.map((team) => (
        <div className="admin-team-row" key={team.id}>
          <div>
            <strong>{team.name}</strong>
            <span>
              {team.status ?? '-'} / {formatDate(team.created_at)}
            </span>
          </div>
          <Button variant={team.status === 'active' ? 'secondary' : 'primary'} onClick={() => onStatusChange(team)}>
            {team.status === 'active' ? t('team.end_team', {}, '结束队伍') : t('admin_react.restoreTeam', {}, '恢复')}
          </Button>
        </div>
      ))}
    </div>
  )
}
