export type UserRole = 'admin' | 'user'

export interface User {
  id: number
  username: string
  email?: string | null
  avatar?: string | null
  signature?: string | null
  role?: UserRole
}

export interface TeamType {
  id: string
  name: string
}

export interface Team {
  id: number
  name: string
  team_type: string
  team_type_name?: string
  leader_id: number
  leader_name?: string
  current_members: number
  max_members: number
  min_combat_power?: number
  status?: string
  requires_approval?: boolean
  pending_applications?: number
  created_at?: string
}

export interface TeamMember {
  id: number
  team_id: number
  user_id: number
  username: string
  avatar?: string | null
  signature?: string | null
  player_name?: string | null
  role: string
  joined_at?: string
}

export interface TeamApplication {
  id: number
  user_id: number
  username: string
  avatar?: string | null
  player_name?: string | null
  max_combat_power?: number
  applied_at?: string
}

export interface ChatMessage {
  id: number
  username: string
  status: string
  content: string
  timestamp?: string
  reply_to_id?: number | null
  reply_to_username?: string | null
  reply_to_content?: string | null
}

export interface TeamChatMessage extends ChatMessage {
  team_id: number
  sender_id: number
}

export interface FriendUser {
  friendship_id?: number
  id: number
  username: string
  email?: string | null
  avatar?: string | null
  signature?: string | null
}

export interface DirectMessage {
  id: number
  sender_id: number
  recipient_id: number
  sender_name: string
  body: string
  created_at: string
}

export interface PlayerBinding {
  playerName: string | null
  createdAt?: string
}

export interface GameBinding {
  player_name: string
  created_at?: string
  combat_power?: string | number | null
  combat_rank?: number | null
  total_mastery_score?: string | number | null
  total_mastery_rank?: number | null
  total_mastery_level_text?: string | null
}

export interface LeaderboardSummary {
  leaderboard_id: string
  leaderboard_type: string
  leaderboard_key?: string | null
  leaderboard_name?: string | null
  category_id?: string | null
  category_name?: string | null
  updated_at?: string
  entry_count: number
  min_rank?: number | null
  max_rank?: number | null
}

export interface LeaderboardEntry {
  entry_index: number
  rank: number
  player_name: string
  score: string
  mastery_level?: number | null
  mastery_level_text?: string | null
  trove_mastery_level?: number | null
  geode_mastery_level?: number | null
}

export interface OnlineUser {
  id: number
  username: string
  avatar?: string | null
}

export interface LeaderboardSearchResult extends LeaderboardSummary {
  entry_index?: number | null
  rank?: number | null
  player_name?: string | null
  score?: string | null
}

export interface LeaderboardVersion {
  hash: string
  updated_at?: string | null
  leaderboard_count?: number
}

export interface LeaderboardDetail {
  leaderboard: LeaderboardSummary
  entries: LeaderboardEntry[]
  items?: LeaderboardEntry[]
  limit: number
  offset: number
}

export interface LeaderboardPlayerProfile {
  player: {
    key: string
    display_name: string
  }
  items: Array<LeaderboardEntry & LeaderboardSummary>
}

export interface Stats {
  totalTeams?: number
  totalMembers?: number
  activeTypes?: string[]
  online_users?: number
}

export interface AdminSummary {
  total_users: number
  total_teams: number
  active_teams: number
  ended_teams: number
  total_messages: number
  pending_applications: number
  bound_players: number
  online_users: number
}

export interface AdminUser extends User {
  created_at?: string
  player_name?: string | null
  team_count?: number
  friend_count?: number
  online?: boolean
}

export interface AdminDatabaseTable {
  name: string
  label: string
  primary_key: string | null
  time_column: string
  rows: number
}

export interface AdminDatabaseRows {
  table: string
  label: string
  primary_key: string | null
  time_column: string
  rows: Array<Record<string, unknown>>
}

export interface AdminCleanupResult {
  success: boolean
  from: string
  to: string
  deleted: Array<{ table: string; label: string; count: number }>
}

export interface AdminApplication {
  id: number
  status: string
  applied_at?: string
  processed_at?: string
  team_id?: number
  team_name?: string
  user_id?: number
  username?: string
  processed_by_name?: string
}

export interface OnlinePresence {
  onlineUsers: number
  onlineUserIds: string[]
}

export type AnnouncementCategory = 'announcement' | 'update' | 'promotion' | 'pts'

export interface TrovePalAnnouncement {
  id: string
  title?: string
  category: AnnouncementCategory
  channel_name: string
  content: string
  author_name: string
  author_username?: string | null
  image_urls: string[]
  posted_at?: string | null
  source_url?: string | null
  has_edits?: boolean
  edit_count?: number
}

export interface TrovePalAnnouncementStatus {
  provider: 'trovepal'
  refreshed_at?: string | null
  last_error?: string | null
  refresh_interval_ms: number
  last_inserted_count?: number
}

export interface TrovePalAnnouncementPagination {
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface TrovePalAnnouncementPayload {
  status: TrovePalAnnouncementStatus
  items: TrovePalAnnouncement[]
  pagination: TrovePalAnnouncementPagination
}

export interface TrovePalAnnouncementInitialization {
  fetched: number
  inserted: number
}

export interface AdminQqOauthConfig {
  api_url: string
  appid: string
  appkey_configured: boolean
  callback_url: string
  frontend_success_path: string
  updated_at?: string | null
}

export interface AdminQqBotConfig {
  app_id: string
  app_secret_configured: boolean
  updated_at?: string | null
}

export type AdminQqBotCommandKey = 'team_list' | 'player_info' | 'latest_news' | 'market' | 'menu' | 'help'
export type AdminQqBotCardKey = 'team_notification' | 'team_list' | 'player_info' | 'latest_news' | 'market' | 'menu'

export interface AdminQqBotContentConfig {
  commands: Record<AdminQqBotCommandKey, string>
  cards: Record<AdminQqBotCardKey, string>
  updated_at?: string | null
}

export interface AdminImageHostConfig {
  base_url: string
  review_folder_id: string
  api_key_configured: boolean
  updated_at?: string | null
}

export interface AdminTrovePalConfig {
  app_name: string
  api_key_configured: boolean
  updated_at?: string | null
}

export type MarketListingCategory = 'flux' | 'items' | 'boosting' | 'accounts' | 'codes'

export interface MarketListingInput {
  category: MarketListingCategory
  title: string
  description: string
  price: number
  price_unit: string
  stock: string
  player_name: string
  delivery_method: string
  is_active?: boolean
}

export interface MarketListing extends MarketListingInput {
  id: number
  seller_id: number
  seller_name?: string
  created_at?: string
  updated_at?: string
  average_rating?: number | null
  review_count?: number
  is_pinned?: boolean
}

export interface AdminMarketListingPage {
  items: MarketListing[]
  total: number
  page: number
  page_size: number
}

export interface MarketConversation {
  id: number
  listing_id: number
  buyer_id: number
  seller_id: number
  listing_title: string
  counterpart_id?: number
  counterpart_name?: string
  buyer_name?: string
  seller_name?: string
  last_message_body?: string | null
  last_message_created_at?: string | null
  last_message_at?: string
  created_at?: string
}

export interface MarketConversationMessage {
  id: number
  conversation_id: number
  sender_id: number
  sender_name: string
  body: string
  created_at: string
}

export interface MarketReview {
  id: number
  conversation_id: number
  rating: 1 | 2 | 3 | 4 | 5
  comment: string
  image_urls: string[]
  buyer_name: string
  created_at: string
  updated_at?: string
}

export type DishonestyReportStatus = 'pending' | 'approved' | 'rejected'

export interface DishonestyReport {
  id: number
  reporter_id?: number
  reporter_name?: string
  dishonest_qq?: string | null
  dishonest_player_name?: string | null
  reason: string
  evidence_urls: string[]
  status?: DishonestyReportStatus
  reviewer_id?: number | null
  reviewer_name?: string | null
  reviewed_at?: string | null
  created_at: string
}

export interface DishonestyReportPage {
  items: DishonestyReport[]
  total: number
  page: number
  page_size: number
}
