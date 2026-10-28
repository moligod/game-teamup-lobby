import { Database, Shield, Trash2, UsersRound } from 'lucide-react'
import { type FormEvent } from 'react'
import { ImageHostConfigPanel, QqBotConfigPanel, QqBotContentConfigPanel, QqOauthConfigPanel, TrovePalConfigPanel } from './AdminConfigPanels'
import { MarketListingPinPanel } from './MarketListingPinPanel'
import { DishonestyReportReviewPanel } from './DishonestyReportReviewPanel'
import { AdminMiniTable, AdminTeamList } from './AdminOperations'
import { formatDate, formatNumber, getErrorMessage } from '@/lib/format'
import type {
  AdminApplication,
  AdminCleanupResult,
  AdminDatabaseRows,
  AdminDatabaseTable,
  AdminImageHostConfig,
  AdminQqBotConfig,
  AdminQqBotContentConfig,
  AdminQqOauthConfig,
  AdminTrovePalConfig,
  AdminSummary,
  AdminUser,
  ChatMessage,
  Team,
} from '@/lib/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { MetricCard } from '@/shared/ui/MetricCard'
import { Notice } from '@/shared/ui/Notice'

type Translate = (key: string, params?: Record<string, string | number>, fallback?: string) => string

export function AdminOverviewPage({ summary, t }: { summary: AdminSummary | null; t: Translate }) {
  if (!summary) return null
  return (
    <section className="admin-page-section">
      <div className="admin-page-heading"><div><h1>{t('adminConsole.overview', undefined, '概览')}</h1><p>{t('adminConsole.overviewHint', undefined, '查看后台当前运行与社区数据。')}</p></div></div>
      <div className="stat-grid wide">
        <MetricCard label={t('admin_react.users')} value={formatNumber(summary.total_users)} />
        <MetricCard label={t('admin_react.teams')} value={formatNumber(summary.total_teams)} />
        <MetricCard label={t('admin_react.activeTeams')} value={formatNumber(summary.active_teams)} />
        <MetricCard label={t('admin_react.pending')} value={formatNumber(summary.pending_applications)} />
        <MetricCard label={t('admin_react.bindings')} value={formatNumber(summary.bound_players)} />
        <MetricCard label={t('admin_react.online')} value={formatNumber(summary.online_users)} />
      </div>
    </section>
  )
}

export function AdminUsersPage({ users, onDelete, t }: { users: AdminUser[]; onDelete: (user: AdminUser) => Promise<void>; t: Translate }) {
  return (
    <section className="panel admin-section admin-page-section">
      <div className="section-head"><h2><UsersRound size={18} /> {t('admin_react.registeredUsers', undefined, '注册用户')}</h2><Badge>{formatNumber(users.length)}</Badge></div>
      <div className="admin-list">
        {users.map((user) => (
          <div className="admin-user-row" key={user.id}>
            <div><strong>{user.username}</strong><span>{user.email || '-'}</span></div>
            <span>{user.player_name || t('team_react.noBinding')}</span>
            <span>{user.online ? t('common.online') : t('common.offline')}</span>
            <span>{formatDate(user.created_at)}</span>
            <IconButton disabled={user.role === 'admin'} label={t('common.delete')} onClick={() => void onDelete(user)} variant="danger"><Trash2 size={16} /></IconButton>
          </div>
        ))}
      </div>
    </section>
  )
}

export function AdminOperationsPage({ teams, messages, applications, onTeamStatusChange, t }: {
  teams: Team[]
  messages: ChatMessage[]
  applications: AdminApplication[]
  onTeamStatusChange: (team: Team) => Promise<void>
  t: Translate
}) {
  return (
    <section className="panel admin-section admin-page-section">
      <div className="section-head"><h2><Shield size={18} /> {t('admin_react.operations', undefined, '运营数据')}</h2><Badge>{formatNumber(teams.length + messages.length + applications.length)}</Badge></div>
      <div className="admin-mini-grid">
        <AdminTeamList title={t('admin_react.teams')} teams={teams.slice(0, 8)} onStatusChange={onTeamStatusChange} />
        <AdminMiniTable title={t('admin_react.messages')} rows={messages.slice(0, 8).map((message) => [message.username, message.content, formatDate(message.timestamp)])} />
        <AdminMiniTable title={t('admin_react.applications')} rows={applications.slice(0, 8).map((item) => [item.username ?? '-', item.status, formatDate(item.applied_at)])} />
      </div>
    </section>
  )
}

export function AdminSettingsPage({
  qqOauthConfig,
  imageHostConfig,
  trovePalConfig,
  token,
  onQqOauthSaved,
  onImageHostSaved,
  onTrovePalSaved,
  onError,
}: {
  qqOauthConfig: AdminQqOauthConfig | null
  imageHostConfig: AdminImageHostConfig | null
  trovePalConfig: AdminTrovePalConfig | null
  token: string
  onQqOauthSaved: (config: AdminQqOauthConfig) => void
  onImageHostSaved: (config: AdminImageHostConfig) => void
  onTrovePalSaved: (config: AdminTrovePalConfig) => void
  onError: (message: string) => void
}) {
  return (
    <div className="admin-settings-grid admin-page-section">
      <TrovePalConfigPanel config={trovePalConfig} token={token} onSaved={onTrovePalSaved} onError={onError} />
      <QqOauthConfigPanel config={qqOauthConfig} token={token} onSaved={onQqOauthSaved} onError={onError} />
      <ImageHostConfigPanel config={imageHostConfig} token={token} onSaved={onImageHostSaved} onError={onError} />
    </div>
  )
}

export function AdminQqBotPage({
  qqBotConfig,
  qqBotContentConfig,
  token,
  onQqBotSaved,
  onQqBotContentSaved,
  onError,
}: {
  qqBotConfig: AdminQqBotConfig | null
  qqBotContentConfig: AdminQqBotContentConfig | null
  token: string
  onQqBotSaved: (config: AdminQqBotConfig) => void
  onQqBotContentSaved: (config: AdminQqBotContentConfig) => void
  onError: (message: string) => void
}) {
  return (
    <div className="admin-qq-bot-page admin-page-section">
      <QqBotConfigPanel config={qqBotConfig} token={token} onSaved={onQqBotSaved} onError={onError} />
      <QqBotContentConfigPanel config={qqBotContentConfig} token={token} onSaved={onQqBotContentSaved} onError={onError} />
    </div>
  )
}

export function AdminMarketPage({ token, onError }: { token: string; onError: (message: string) => void }) {
  return <div className="admin-page-section"><MarketListingPinPanel token={token} onError={onError} /><DishonestyReportReviewPanel token={token} onError={onError} /></div>
}

export function AdminDataPage({
  tables,
  activeTable,
  activeTableMeta,
  tableRows,
  from,
  to,
  cleanupResult,
  onFromChange,
  onToChange,
  onCleanup,
  onTableSelect,
  onDeleteRow,
  t,
}: {
  tables: AdminDatabaseTable[]
  activeTable: string
  activeTableMeta?: AdminDatabaseTable
  tableRows: AdminDatabaseRows | null
  from: string
  to: string
  cleanupResult: AdminCleanupResult | null
  onFromChange: (value: string) => void
  onToChange: (value: string) => void
  onCleanup: (event: FormEvent) => Promise<void>
  onTableSelect: (tableName: string) => void
  onDeleteRow: (row: Record<string, unknown>) => Promise<void>
  t: Translate
}) {
  return (
    <div className="admin-data-stack admin-page-section">
      <section className="panel admin-section cleanup-panel">
        <div className="section-head"><h2>{t('admin_react.cleanup', undefined, '按时间清理')}</h2></div>
        <form className="form-stack" onSubmit={(event) => void onCleanup(event)}>
          <label>{t('admin_react.fromTime', undefined, '开始时间')}<input onChange={(event) => onFromChange(event.target.value)} required type="datetime-local" value={from} /></label>
          <label>{t('admin_react.toTime', undefined, '结束时间')}<input onChange={(event) => onToChange(event.target.value)} required type="datetime-local" value={to} /></label>
          <Button fullWidth icon={<Trash2 size={16} />} type="submit" variant="danger">{t('admin_react.cleanupButton', undefined, '一键删除范围内数据')}</Button>
        </form>
        {cleanupResult ? <div className="cleanup-result">{cleanupResult.deleted.map((item) => <div className="mini-item compact" key={item.table}><strong>{item.label}</strong><span>{formatNumber(item.count)}</span></div>)}</div> : <p className="muted">{t('admin_react.cleanupNote', undefined, '不会删除管理员账号和队伍类型配置。')}</p>}
      </section>
      <section className="panel admin-section database-browser">
        <div className="section-head"><h2><Database size={18} /> {t('admin_react.database', undefined, '数据库')}</h2>{activeTableMeta ? <Badge>{formatNumber(activeTableMeta.rows)}</Badge> : null}</div>
        <div className="database-layout">
          <div className="table-picker" role="list">{tables.map((table) => <button className={table.name === activeTable ? 'active' : ''} key={table.name} onClick={() => onTableSelect(table.name)} type="button"><span>{table.label}</span><em>{formatNumber(table.rows)}</em></button>)}</div>
          <div className="db-row-list">
            {tableRows?.rows.length === 0 ? <div className="empty">{t('common.no_data')}</div> : null}
            {tableRows?.rows.map((row, index) => <div className="db-row" key={index}><pre>{formatRow(row)}</pre><IconButton disabled={!tableRows.primary_key} label={t('common.delete')} onClick={() => void onDeleteRow(row)} variant="danger"><Trash2 size={16} /></IconButton></div>)}
          </div>
        </div>
      </section>
    </div>
  )
}

function formatRow(row: Record<string, unknown>) {
  return JSON.stringify(row, (_, value) => (value === null ? undefined : value), 2)
}
