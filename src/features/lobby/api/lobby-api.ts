import { get, post } from '@/lib/api'
import { getFriendRequests, getFriends } from '@/features/social/api/social-api'
import { getGameBindings, getPlayerBinding } from '@/features/players/api/player-api'
import type {
  ChatMessage,
  FriendUser,
  GameBinding,
  PlayerBinding,
  Team,
  TeamApplication,
  TeamChatMessage,
  TeamMember,
  TeamType,
} from '@/lib/types'

export interface LobbySnapshot {
  teamTypes: TeamType[]
  teams: Team[]
  messages: ChatMessage[]
}

export interface UserLobbySnapshot {
  userTeams: Team[]
  friends: FriendUser[]
  friendRequests: FriendUser[]
  binding: PlayerBinding
  gameBindings: GameBinding[]
}

export interface TeamPanelSnapshot {
  members: TeamMember[]
  applications: TeamApplication[]
}

export function getLobbyTeamTypes() {
  return get<TeamType[]>('/api/team-types')
}

export function getLobbyTeams() {
  return get<Team[]>('/api/teams')
}

export function getLobbySnapshot(): Promise<LobbySnapshot> {
  return Promise.all([
    getLobbyTeamTypes(),
    getLobbyTeams(),
    get<ChatMessage[]>('/api/messages?limit=100'),
  ]).then(([teamTypes, teams, messages]) => ({ teamTypes, teams, messages }))
}

export function getLobbyMessages() {
  return get<ChatMessage[]>('/api/messages?limit=100')
}

export function sendLobbyMessage(input: { username: string; status: string; content: string; reply_to_id?: number | null }) {
  return post<ChatMessage>('/api/messages', input)
}

export function getTeamMessages(teamId: number) {
  return get<TeamChatMessage[]>(`/api/teams/${teamId}/messages?limit=60`)
}

export function sendTeamMessage(teamId: number, input: { content: string; reply_to_id?: number | null }) {
  return post<TeamChatMessage>(`/api/teams/${teamId}/messages`, input)
}

export function createTeam(input: {
  name: string
  team_type: string
  leader_id: number
  max_members: number
  min_combat_power: number
  requires_approval: boolean
}) {
  return post<Team>('/api/teams', input)
}

export function joinTeam(teamId: number, userId: number) {
  return post(`/api/teams/${teamId}/join`, { user_id: userId })
}

export function applyToTeam(teamId: number, userId: number) {
  return post(`/api/teams/${teamId}/apply`, { user_id: userId })
}

export function leaveTeam(teamId: number, userId: number) {
  return post(`/api/teams/${teamId}/leave`, { user_id: userId })
}

export function endTeam(teamId: number, leaderId: number) {
  return post(`/api/teams/${teamId}/end`, { leader_id: leaderId })
}

export function processTeamApplication(applicationId: number, leaderId: number, action: 'approve' | 'reject') {
  return post(`/api/team-applications/${applicationId}/process`, { leader_id: leaderId, action })
}

export function getUserTeams(userId: number) {
  return get<Team[]>(`/api/users/${userId}/teams`)
}

export function getUserFriends(userId: number) {
  return getFriends(userId)
}

export function getUserFriendRequests(userId: number) {
  return getFriendRequests(userId)
}

export function getUserLobbySnapshot(userId: number): Promise<UserLobbySnapshot> {
  return Promise.all([
    getUserTeams(userId),
    getUserFriends(userId),
    getUserFriendRequests(userId),
    getPlayerBinding(userId),
    getGameBindings(userId),
  ]).then(([userTeams, friends, friendRequests, binding, gameBindings]) => ({
    userTeams,
    friends,
    friendRequests,
    binding,
    gameBindings,
  }))
}

export async function getTeamPanelSnapshot(teamId: number, leaderId?: number): Promise<TeamPanelSnapshot> {
  const membersRequest = get<TeamMember[]>(`/api/teams/${teamId}/members`)
  const applicationsRequest = leaderId
    ? get<TeamApplication[]>(`/api/teams/${teamId}/applications?leader_id=${leaderId}`)
    : Promise.resolve([])
  const [members, applications] = await Promise.all([membersRequest, applicationsRequest])
  return { members, applications }
}
