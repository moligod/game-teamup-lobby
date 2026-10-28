import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { subscribeWebSocket } from '@/lib/ws'
import { getLobbyMessages } from '../api/lobby-api'
import {
  appendUniqueRealtimeMessage,
  createKeyedRefreshScheduler,
} from './keyed-refresh-scheduler'
import { notifyTeamApplicationReceived, notifyTeamMemberJoined } from '../team-join-notifications'
import type { ChatMessage, Team, TeamChatMessage } from '@/lib/types'

const TEAM_LIST_REFRESH_EVENTS = new Set([
  'team_created',
  'team_joined',
  'team_left',
  'team_ended',
  'team_list_update',
])

const USER_TEAM_REFRESH_EVENTS = new Set([
  'team_application_accepted',
  'user_team_update',
])

const FRIENDS_REFRESH_EVENTS = new Set([
  'friend_accepted',
  'friend_removed',
  'friend_list_update',
])

const FRIEND_REQUESTS_REFRESH_EVENTS = new Set([
  'friend_request',
  'friend_rejected',
  'friend_request_update',
])

interface UseLobbyRealtimeOptions {
  selectedTeam: Team | null
  viewedTeam: Team | null
  currentUserId?: number | null
  activeTeamId: number | null
  joinedTeamIds: ReadonlySet<number>
  loadTeams: () => Promise<void>
  loadTeamTypes: () => Promise<void>
  loadUserTeams: () => Promise<void>
  loadFriends: () => Promise<void>
  loadFriendRequests: () => Promise<void>
  loadTeamPanel: (team: Team) => Promise<void>
  loadViewedTeam: (team: Team) => Promise<void>
  loadTeamMessages: (teamId: number) => Promise<void>
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>
  setTeamMessages: Dispatch<SetStateAction<TeamChatMessage[]>>
  onTeamApplication: (data: unknown) => void
  onTeamApplicationRejected: (data: unknown) => void
}

interface TeamJoinedEvent {
  teamId: number
  teamName: string
  memberId: number | null
  memberName: string
}

interface TeamApplicationEvent {
  teamName: string
}

function positiveInteger(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function withIncrementedMemberCount(team: Team) {
  return {
    ...team,
    current_members: Math.min(team.max_members, team.current_members + 1),
  }
}

function readEventTeamId(data: unknown) {
  if (!data || typeof data !== 'object') return null
  const raw = data as { id?: unknown; teamId?: unknown; team?: unknown }
  const directId = positiveInteger(raw.teamId ?? raw.id)
  if (directId) return directId
  if (!raw.team || typeof raw.team !== 'object') return null
  return positiveInteger((raw.team as { id?: unknown }).id)
}

function readTeamJoinedEvent(data: unknown): TeamJoinedEvent | null {
  if (!data || typeof data !== 'object') return null

  const { team, member } = data as { team?: unknown; member?: unknown }
  if (!team || typeof team !== 'object' || !member || typeof member !== 'object') return null

  const rawTeam = team as { id?: unknown; name?: unknown }
  const rawMember = member as { id?: unknown; username?: unknown }
  const teamId = positiveInteger(rawTeam.id)
  if (!teamId) return null

  return {
    teamId,
    teamName: typeof rawTeam.name === 'string' ? rawTeam.name : '',
    memberId: positiveInteger(rawMember.id),
    memberName: typeof rawMember.username === 'string' ? rawMember.username : '',
  }
}

function readTeamApplicationEvent(data: unknown): TeamApplicationEvent | null {
  if (!data || typeof data !== 'object') return null

  const teamName = (data as { teamName?: unknown }).teamName
  if (typeof teamName !== 'string' || !teamName.trim()) return null

  return { teamName }
}

function readChatMessage(data: unknown): ChatMessage | null {
  if (!data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const id = positiveInteger(raw.id)
  if (!id || typeof raw.username !== 'string' || typeof raw.status !== 'string' || typeof raw.content !== 'string') {
    return null
  }

  const replyToId = raw.reply_to_id === null || raw.reply_to_id === undefined
    ? null
    : positiveInteger(raw.reply_to_id)
  if (raw.reply_to_id !== null && raw.reply_to_id !== undefined && !replyToId) return null

  return {
    id,
    username: raw.username,
    status: raw.status,
    content: raw.content,
    timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : undefined,
    reply_to_id: replyToId,
    reply_to_username: typeof raw.reply_to_username === 'string' ? raw.reply_to_username : undefined,
    reply_to_content: typeof raw.reply_to_content === 'string' ? raw.reply_to_content : undefined,
  }
}

function readTeamChatMessage(data: unknown): TeamChatMessage | null {
  const message = readChatMessage(data)
  if (!message || !data || typeof data !== 'object') return null
  const raw = data as Record<string, unknown>
  const teamId = positiveInteger(raw.team_id)
  const senderId = positiveInteger(raw.sender_id)
  if (!teamId || !senderId) return null
  return { ...message, team_id: teamId, sender_id: senderId }
}

function hasCompleteReply(message: ChatMessage) {
  return message.reply_to_id === null || message.reply_to_id === undefined || (
    typeof message.reply_to_username === 'string'
    && typeof message.reply_to_content === 'string'
  )
}

export function useLobbyRealtime({
  selectedTeam,
  viewedTeam,
  currentUserId = null,
  activeTeamId,
  joinedTeamIds,
  loadTeams,
  loadTeamTypes,
  loadUserTeams,
  loadFriends,
  loadFriendRequests,
  loadTeamPanel,
  loadViewedTeam,
  loadTeamMessages,
  setMessages,
  setTeamMessages,
  onTeamApplication,
  onTeamApplicationRejected,
}: UseLobbyRealtimeOptions) {
  const selectedTeamRef = useRef(selectedTeam)
  const viewedTeamRef = useRef(viewedTeam)
  const joinedTeamIdsRef = useRef(joinedTeamIds)

  useEffect(() => {
    selectedTeamRef.current = selectedTeam
  }, [selectedTeam])

  useEffect(() => {
    viewedTeamRef.current = viewedTeam
  }, [viewedTeam])

  useEffect(() => {
    joinedTeamIdsRef.current = joinedTeamIds
  }, [joinedTeamIds])

  useEffect(() => {
    const scheduler = createKeyedRefreshScheduler<string>({ delayMs: 200 })
    const schedule = scheduler.schedule

    const scheduleSelectedPanel = (teamId: number | null) => {
      const selected = selectedTeamRef.current
      if (!selected || (teamId && selected.id !== teamId)) return
      schedule('selected-team-panel', async () => {
        const latest = selectedTeamRef.current
        if (latest && (!teamId || latest.id === teamId)) await loadTeamPanel(latest)
      })
    }

    const scheduleViewedPanel = (teamId: number | null) => {
      const viewed = viewedTeamRef.current
      if (!viewed || (teamId && viewed.id !== teamId)) return
      schedule('viewed-team-panel', async () => {
        const latest = viewedTeamRef.current
        if (latest && (!teamId || latest.id === teamId)) await loadViewedTeam(latest)
      })
    }

    const unsubscribe = subscribeWebSocket((message) => {
      if (message.type === 'team_application') {
        onTeamApplication(message.data)
        const event = readTeamApplicationEvent(message.data)
        if (event) notifyTeamApplicationReceived(event)
        scheduleSelectedPanel(readEventTeamId(message.data))
      }

      if (message.type === 'team_application_rejected') {
        onTeamApplicationRejected(message.data)
      }

      if (message.type === 'team_joined') {
        const event = readTeamJoinedEvent(message.data)
        let teamToRefresh = selectedTeamRef.current
        let viewedTeamToRefresh = viewedTeamRef.current

        if (event && event.memberId !== currentUserId && joinedTeamIdsRef.current.has(event.teamId)) {
          notifyTeamMemberJoined({
            teamName: event.teamName || teamToRefresh?.name || '',
            memberName: event.memberName,
          })
        }

        if (event && teamToRefresh?.id === event.teamId) {
          teamToRefresh = withIncrementedMemberCount(teamToRefresh)
          selectedTeamRef.current = teamToRefresh
        }

        if (event && viewedTeamToRefresh?.id === event.teamId) {
          viewedTeamToRefresh = withIncrementedMemberCount(viewedTeamToRefresh)
          viewedTeamRef.current = viewedTeamToRefresh
        }
      }

      if (TEAM_LIST_REFRESH_EVENTS.has(message.type)) {
        schedule('teams', loadTeams)
      }

      if (message.type === 'team_types_update') {
        schedule('team-types', loadTeamTypes)
        schedule('teams', loadTeams)
      }

      if (message.type === 'team_joined' || message.type === 'team_left') {
        const teamId = readEventTeamId(message.data)
        scheduleSelectedPanel(teamId)
        scheduleViewedPanel(teamId)
      }

      if (USER_TEAM_REFRESH_EVENTS.has(message.type)) {
        schedule('user-teams', loadUserTeams)
      }

      if (FRIENDS_REFRESH_EVENTS.has(message.type)) {
        schedule('friends', loadFriends)
      }

      if (FRIEND_REQUESTS_REFRESH_EVENTS.has(message.type)) {
        schedule('friend-requests', loadFriendRequests)
      }

      if (message.type === 'new_chat_message') {
        const chatMessage = readChatMessage(message.data)
        if (chatMessage && hasCompleteReply(chatMessage)) {
          setMessages((current) => appendUniqueRealtimeMessage(current, chatMessage, 100))
        } else {
          schedule('lobby-messages', async () => setMessages(await getLobbyMessages()))
        }
      }

      if (message.type === 'chat_message_update') {
        schedule('lobby-messages', async () => setMessages(await getLobbyMessages()))
      }

      if (message.type === 'team_chat_message') {
        const teamMessage = readTeamChatMessage(message.data)
        if (!teamMessage || !activeTeamId || teamMessage.team_id !== activeTeamId) return

        if (hasCompleteReply(teamMessage)) {
          setTeamMessages((current) => appendUniqueRealtimeMessage(current, teamMessage, 60))
        } else {
          schedule(`team-messages:${teamMessage.team_id}`, () => loadTeamMessages(teamMessage.team_id))
        }
      }
    })

    return () => {
      unsubscribe()
      scheduler.dispose()
    }
  }, [activeTeamId, currentUserId, loadFriendRequests, loadFriends, loadTeamMessages, loadTeamPanel, loadTeamTypes, loadTeams, loadUserTeams, loadViewedTeam, onTeamApplication, onTeamApplicationRejected, setMessages, setTeamMessages])
}
