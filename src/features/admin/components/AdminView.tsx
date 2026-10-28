import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LogIn, LogOut, RefreshCw, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  cleanupAdminDatabase,
  deleteAdminTableRow,
  deleteAdminUser,
  getAdminDashboard,
  getAdminTable,
  loginAdmin as requestAdminLogin,
  updateAdminTeamStatus,
} from '../api/admin-api'
import { clearAdminSession, loadAdminSession, storeAdminSession, type AdminSession } from '../auth/admin-session'
import { AdminDataPage, AdminMarketPage, AdminOperationsPage, AdminOverviewPage, AdminQqBotPage, AdminSettingsPage, AdminUsersPage } from './AdminPages'
import { AdminAnnouncementsPage } from './AdminAnnouncementsPage'
import { AdminSectionNav, type AdminSectionId } from './AdminSectionNav'
import { getErrorMessage } from '@/lib/format'
import { ApiError } from '@/lib/api'
import { useI18n } from '@/lib/i18n-react'
import type {
  AdminApplication,
  AdminCleanupResult,
  AdminDatabaseRows,
  AdminDatabaseTable,
  AdminImageHostConfig,
  AdminQqBotConfig,
  AdminQqBotContentConfig,
  AdminQqOauthConfig,
  AdminSummary,
  AdminUser,
  ChatMessage,
  Team,
} from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { Notice } from '@/shared/ui/Notice'
import '../admin-console.css'

export function AdminView() {
  const { t } = useI18n()
  const [adminSession, setAdminSession] = useState<AdminSession>(() => loadAdminSession())
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [tables, setTables] = useState<AdminDatabaseTable[]>([])
  const [qqBotConfig, setQqBotConfig] = useState<AdminQqBotConfig | null>(null)
  const [qqBotContentConfig, setQqBotContentConfig] = useState<AdminQqBotContentConfig | null>(null)
  const [qqOauthConfig, setQqOauthConfig] = useState<AdminQqOauthConfig | null>(null)
  const [imageHostConfig, setImageHostConfig] = useState<AdminImageHostConfig | null>(null)
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview')
  const [activeTable, setActiveTable] = useState('users')
  const [tableRows, setTableRows] = useState<AdminDatabaseRows | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cleanupResult, setCleanupResult] = useState<AdminCleanupResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loginBusy, setLoginBusy] = useState(false)

  const token = adminSession.token
  const isAdmin = adminSession.user?.role === 'admin' && Boolean(token)

  const clearAdminState = useCallback((message: string | null = null) => {
    clearAdminSession()
    setAdminSession({ user: null, token: null })
    setSummary(null)
    setUsers([])
    setTeams([])
    setMessages([])
    setApplications([])
    setTables([])
    setQqBotConfig(null)
    setQqBotContentConfig(null)
    setQqOauthConfig(null)
    setImageHostConfig(null)
    setTableRows(null)
    setCleanupResult(null)
    setError(message)
  }, [])

  const loadTable = useCallback(async (tableName: string) => {
    if (!isAdmin || !token) return
    const payload = await getAdminTable(tableName, token)
    setTableRows(payload)
    setActiveTable(tableName)
  }, [isAdmin, token])

  const loadAdmin = useCallback(async (preferredTable = 'users') => {
    if (!isAdmin || !token) return
    setError(null)
    try {
      const dashboard = await getAdminDashboard(token)
      setSummary(dashboard.summary)
      setUsers(dashboard.users)
      setTeams(dashboard.teams)
      setMessages(dashboard.messages)
      setApplications(dashboard.applications)
      setTables(dashboard.tables)
      setQqBotConfig(dashboard.qqBotConfig)
      setQqBotContentConfig(dashboard.qqBotContentConfig)
      setQqOauthConfig(dashboard.qqOauthConfig)
      setImageHostConfig(dashboard.imageHostConfig)
      const nextTable = dashboard.tables.some((item) => item.name === preferredTable) ? preferredTable : dashboard.tables[0]?.name ?? 'users'
      await loadTable(nextTable)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        clearAdminState(t('admin_react.sessionExpired', undefined, '管理员登录已失效，请重新输入账号密码。'))
        return
      }
      setError(getErrorMessage(err))
    }
  }, [clearAdminState, isAdmin, loadTable, t, token])

  useEffect(() => {
    void loadAdmin()
  }, [loadAdmin])

  const activeTableMeta = useMemo(() => tables.find((item) => item.name === activeTable), [activeTable, tables])

  async function deleteUser(user: AdminUser) {
    if (user.role === 'admin' || !token) return
    try {
      await deleteAdminUser(user.id, token)
      await loadAdmin(activeTable)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!tableRows?.primary_key || !token) return
    const id = row[tableRows.primary_key]
    if (id === undefined || id === null) return
    try {
      await deleteAdminTableRow(tableRows.table, String(id), token)
      await loadAdmin(tableRows.table)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function cleanup(event: FormEvent) {
    event.preventDefault()
    if (!token) return
    setError(null)
    setCleanupResult(null)
    try {
      const payload = await cleanupAdminDatabase(from, to, token)
      setCleanupResult(payload)
      await loadAdmin(activeTable)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function updateTeamStatus(team: Team) {
    if (!token) return
    try {
      const nextStatus = team.status === 'active' ? 'ended' : 'active'
      await updateAdminTeamStatus(team.id, nextStatus, token)
      await loadAdmin(activeTable)
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  async function loginAdmin(event: FormEvent) {
    event.preventDefault()
    setLoginBusy(true)
    setError(null)
    try {
      const payload = await requestAdminLogin(identifier, password)
      storeAdminSession(payload.user, payload.token)
      setAdminSession({ user: payload.user, token: payload.token })
      setPassword('')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoginBusy(false)
    }
  }

  function selectTable(tableName: string) {
    void loadTable(tableName).catch((err) => setError(getErrorMessage(err)))
  }

  if (!isAdmin) {
    return (
      <section className="admin-login-shell">
        <div className="admin-login-brand"><Shield size={19} /><span><strong>Game Hub</strong><small>{t('adminConsole.brandSubtitle', undefined, '管理控制台')}</small></span></div>
        <div className="admin-login-intro"><h1>{t('admin_react.adminLogin', undefined, '管理员登录')}</h1><p>{t('admin_react.loginPrompt', undefined, '请输入管理员账号进入后台。')}</p></div>
        <form className="panel form-stack admin-login-panel" onSubmit={loginAdmin}>
          {error ? <Notice variant="error">{error}</Notice> : null}
          <label>{t('common.account')}<input onChange={(event) => setIdentifier(event.target.value)} placeholder={t('team_react.usernameOrEmail')} required value={identifier} /></label>
          <label>{t('auth.password')}<input onChange={(event) => setPassword(event.target.value)} placeholder={t('team_react.passwordHint')} required type="password" value={password} /></label>
          <Button fullWidth icon={<LogIn size={16} />} loading={loginBusy} type="submit" variant="primary">{loginBusy ? t('common.processing') : t('auth.login')}</Button>
        </form>
        <Link className="admin-login-back" to="/"><ArrowLeft size={15} /> {t('adminConsole.backToSite', undefined, '返回网站')}</Link>
      </section>
    )
  }

  let page: ReactNode
  switch (activeSection) {
    case 'users':
      page = <AdminUsersPage onDelete={deleteUser} t={t} users={users} />
      break
    case 'operations':
      page = <AdminOperationsPage applications={applications} messages={messages} onTeamStatusChange={updateTeamStatus} t={t} teams={teams} />
      break
    case 'announcements':
      page = <AdminAnnouncementsPage token={token!} />
      break
    case 'settings':
      page = <AdminSettingsPage imageHostConfig={imageHostConfig} onError={setError} onImageHostSaved={setImageHostConfig} onQqOauthSaved={setQqOauthConfig} qqOauthConfig={qqOauthConfig} token={token!} />
      break
    case 'qq-bot':
      page = <AdminQqBotPage onError={setError} onQqBotContentSaved={setQqBotContentConfig} onQqBotSaved={setQqBotConfig} qqBotConfig={qqBotConfig} qqBotContentConfig={qqBotContentConfig} token={token!} />
      break
    case 'market':
      page = <AdminMarketPage onError={setError} token={token!} />
      break
    case 'data':
      page = <AdminDataPage activeTable={activeTable} activeTableMeta={activeTableMeta} cleanupResult={cleanupResult} from={from} onCleanup={cleanup} onDeleteRow={deleteRow} onFromChange={setFrom} onTableSelect={selectTable} onToChange={setTo} t={t} tableRows={tableRows} tables={tables} to={to} />
      break
    default:
      page = <AdminOverviewPage summary={summary} t={t} />
  }

  return (
    <section className="admin-console">
      <header className="admin-console-header">
        <div className="admin-console-title"><Shield size={19} /><div><strong>Game Hub</strong><span>{t('adminConsole.brandSubtitle', undefined, '管理控制台')}</span></div></div>
        <div className="admin-console-actions"><Button icon={<RefreshCw size={16} />} onClick={() => void loadAdmin(activeTable)} variant="secondary">{t('common.refresh')}</Button><Link className="button secondary admin-back-link" to="/"><ArrowLeft size={16} /> {t('adminConsole.backToSite', undefined, '返回网站')}</Link><Button icon={<LogOut size={16} />} onClick={() => clearAdminState()} variant="secondary">{t('auth.logout')}</Button></div>
      </header>
      <div className="admin-console-body">
        <AdminSectionNav activeSection={activeSection} onSelect={setActiveSection} t={t} />
        <main className="admin-console-content">
          {error ? <Notice variant="error">{error}</Notice> : null}
          {page}
        </main>
      </div>
    </section>
  )
}
