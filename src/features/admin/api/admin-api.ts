import { del, get, patch, post, put } from '@/lib/api'
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
  AdminMarketListingPage,
  ChatMessage,
  Team,
  TrovePalAnnouncementInitialization,
  User,
  MarketListing,
  DishonestyReport,
  DishonestyReportPage,
} from '@/lib/types'

export interface AdminLoginResponse {
  user: User
  token: string
}

export interface AdminDashboardSnapshot {
  summary: AdminSummary
  users: AdminUser[]
  teams: Team[]
  messages: ChatMessage[]
  applications: AdminApplication[]
  tables: AdminDatabaseTable[]
  qqBotConfig: AdminQqBotConfig
  qqBotContentConfig: AdminQqBotContentConfig
  qqOauthConfig: AdminQqOauthConfig
  imageHostConfig: AdminImageHostConfig
  trovePalConfig: AdminTrovePalConfig
}

export function loginAdmin(identifier: string, password: string) {
  return post<AdminLoginResponse>('/api/admin/login', { identifier, password })
}

export async function getAdminDashboard(token: string): Promise<AdminDashboardSnapshot> {
  const [summary, users, teams, messages, applications, tables, qqBotConfig, qqBotContentConfig, qqOauthConfig, imageHostConfig, trovePalConfig] = await Promise.all([
    get<AdminSummary>('/api/admin/summary', token),
    get<AdminUser[]>('/api/admin/users', token),
    get<Team[]>('/api/admin/teams', token),
    get<ChatMessage[]>('/api/admin/messages', token),
    get<AdminApplication[]>('/api/admin/applications', token),
    get<AdminDatabaseTable[]>('/api/admin/database/tables', token),
    get<AdminQqBotConfig>('/api/admin/qq-bot-config', token),
    get<AdminQqBotContentConfig>('/api/admin/qq-bot-content-config', token),
    get<AdminQqOauthConfig>('/api/admin/qq-oauth-config', token),
    get<AdminImageHostConfig>('/api/admin/image-host-config', token),
    get<AdminTrovePalConfig>('/api/admin/trovepal-config', token),
  ])
  return { summary, users, teams, messages, applications, tables, qqBotConfig, qqBotContentConfig, qqOauthConfig, imageHostConfig, trovePalConfig }
}

export function getAdminTable(tableName: string, token: string) {
  return get<AdminDatabaseRows>(`/api/admin/database/${tableName}`, token)
}

export function deleteAdminUser(userId: number, token: string) {
  return del<{ success: boolean }>(`/api/admin/users/${userId}`, undefined, token)
}

export function deleteAdminTableRow(tableName: string, id: string, token: string) {
  return del<{ success: boolean; deleted: number }>(
    `/api/admin/database/${tableName}/${encodeURIComponent(id)}`,
    undefined,
    token,
  )
}

export function cleanupAdminDatabase(from: string, to: string, token: string) {
  return post<AdminCleanupResult>('/api/admin/database/cleanup', { from, to }, token)
}

export function updateAdminTeamStatus(teamId: number, status: 'active' | 'ended', token: string) {
  return patch<{ success: boolean; team: Team }>(`/api/admin/teams/${teamId}/status`, { status }, token)
}

export function initializeTrovePalAnnouncements(token: string) {
  return post<TrovePalAnnouncementInitialization>('/api/admin/announcements/initialize', {}, token)
}

export function saveQqOauthConfig(
  input: {
    api_url: string
    appid: string
    appkey: string
    clear_appkey: boolean
    callback_url: string
    frontend_success_path: string
  },
  token: string,
) {
  return put<AdminQqOauthConfig>('/api/admin/qq-oauth-config', input, token)
}

export function saveQqBotConfig(
  input: { app_id: string; app_secret: string; clear_app_secret: boolean },
  token: string,
) {
  return put<AdminQqBotConfig>('/api/admin/qq-bot-config', input, token)
}

export function saveQqBotContentConfig(
  input: Pick<AdminQqBotContentConfig, 'commands' | 'cards'>,
  token: string,
) {
  return put<AdminQqBotContentConfig>('/api/admin/qq-bot-content-config', input, token)
}

export function saveImageHostConfig(
  input: { base_url: string; api_key: string; clear_api_key: boolean; review_folder_id: string },
  token: string,
) {
  return put<AdminImageHostConfig>('/api/admin/image-host-config', input, token)
}

export function saveTrovePalConfig(
  input: { app_name: string; api_key: string; clear_api_key: boolean },
  token: string,
) {
  return put<AdminTrovePalConfig>('/api/admin/trovepal-config', input, token)
}

export function getAdminMarketListings(query: string, page: number, token: string) {
  return get<AdminMarketListingPage>(`/api/admin/market/listings?query=${encodeURIComponent(query)}&page=${page}&limit=20`, token)
}

export function setAdminMarketListingPinned(id: number, isPinned: boolean, token: string) {
  return put<MarketListing>(`/api/admin/market/listings/${id}/pin`, { is_pinned: isPinned }, token)
}

export function deleteAdminMarketListing(id: number, token: string) {
  return del<{ id: number }>(`/api/admin/market/listings/${id}`, undefined, token)
}

export function getAdminDishonestyReports(query: string, status: 'pending' | 'approved' | 'rejected' | 'all', page: number, token: string) {
  return get<DishonestyReportPage>(`/api/admin/market/dishonesty-reports?query=${encodeURIComponent(query)}&status=${status}&page=${page}&limit=20`, token)
}

export function reviewAdminDishonestyReport(id: number, status: 'approved' | 'rejected', token: string) {
  return put<DishonestyReport>(`/api/admin/market/dishonesty-reports/${id}/review`, { status }, token)
}
