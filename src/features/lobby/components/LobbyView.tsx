import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getLobbyTeams,
  getLobbyTeamTypes,
  getLobbySnapshot,
  getTeamMessages,
  getTeamPanelSnapshot,
  getUserFriendRequests,
  getUserFriends,
  getUserLobbySnapshot,
  getUserTeams,
} from '../api/lobby-api'
import { ChatChannelPanel, ConnectionsPanel } from './SocialPanel'
import { TeamsPanel, type RunAction } from './TeamsPanel'
import { useLobbyRealtime } from '../hooks/use-lobby-realtime'
import { AuthPanel } from '@/features/players/components/AuthPanel'
import { getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type {
  ChatMessage,
  DirectMessage,
  FriendUser,
  GameBinding,
  PlayerBinding,
  Team,
  TeamApplication,
  TeamChatMessage,
  TeamMember,
  TeamType,
} from '@/lib/types'
import { Toast, type ToastPlacement, type ToastVariant } from '@/shared/ui/Toast'

interface FeedbackMessage {
  id: number
  message: string
  variant: ToastVariant
  duration?: number
  placement?: ToastPlacement
}

export interface LobbyViewProps {
  user: import('@/lib/types').User | null
  loginWithQQ: () => Promise<void>
  loginLocal: (mode: 'login' | 'register', username: string, password: string) => Promise<void>
  onlineUserIds: string[]
}

function readApplicationTeamName(data: unknown) {
  if (!data || typeof data !== 'object') return null

  const rawData = data as { teamName?: unknown; team?: unknown }
  if (typeof rawData.teamName === 'string' && rawData.teamName.trim()) return rawData.teamName
  if (!rawData.team || typeof rawData.team !== 'object') return null

  const name = (rawData.team as { name?: unknown }).name
  return typeof name === 'string' && name.trim() ? name : null
}

export function LobbyView({ user, loginWithQQ, loginLocal, onlineUserIds }: LobbyViewProps) {
  const { locale, t } = useI18n()

  const [teams, setTeams] = useState<Team[]>([])
  const [teamTypes, setTeamTypes] = useState<TeamType[]>([])
  const [userTeams, setUserTeams] = useState<Team[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [teamMessages, setTeamMessages] = useState<TeamChatMessage[]>([])
  const [friends, setFriends] = useState<FriendUser[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendUser[]>([])
  const [privateFriend, setPrivateFriend] = useState<FriendUser | null>(null)
  const [binding, setBinding] = useState<PlayerBinding>({ playerName: null })
  const [gameBindings, setGameBindings] = useState<GameBinding[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [applications, setApplications] = useState<TeamApplication[]>([])
  const [viewedTeam, setViewedTeam] = useState<Team | null>(null)
  const [viewedMembers, setViewedMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)
  const selectedTeamRequestId = useRef(0)
  const viewedTeamRequestId = useRef(0)

  const currentUserId = user?.id

  const showFeedback = useCallback((message: string, variant: ToastVariant = 'error', options?: Pick<FeedbackMessage, 'duration' | 'placement'>) => {
    setFeedback({ id: Date.now(), message, variant, ...options })
  }, [])

  const showInviteCopied = useCallback(() => {
    showFeedback(
      t('team_react.inviteCopied', undefined, '\u5df2\u590d\u5236\u73a9\u5bb6\u540d'),
      'success',
      { duration: 1000, placement: 'top' },
    )
  }, [showFeedback, t])

  const showTeamApplicationRejectedNotice = useCallback((data: unknown) => {
    const teamName = readApplicationTeamName(data) ?? t('team_react.teamNameShort')
    showFeedback(
      t(
        'team_react.applicationRejectedNotice',
        { team: teamName },
        '\u961f\u4f0d\u300c{team}\u300d\u62d2\u7edd\u4e86\u4f60\u7684\u5165\u961f\u7533\u8bf7\u3002',
      ),
      'error',
      { duration: 6000, placement: 'top' },
    )
  }, [showFeedback, t])

  const showTeamApplicationNotice = useCallback((data: unknown) => {
    const teamName = readApplicationTeamName(data) ?? t('team_react.teamNameShort')
    showFeedback(
      t('team_react.newApplicationNotice', { team: teamName }, '\u961f\u4f0d\u300c{team}\u300d\u6709\u65b0\u7684\u5165\u961f\u7533\u8bf7\uff0c\u8bf7\u53ca\u65f6\u5904\u7406\u3002'),
      'warning',
      { duration: 6000, placement: 'top' },
    )
  }, [showFeedback, t])

  const showDirectMessageNotice = useCallback((message: DirectMessage) => {
    showFeedback(
      t('team_react.directMessageNotice', { friend: message.sender_name }, '{friend} 发来了一条私聊消息。'),
      'warning',
      { duration: 6000, placement: 'top' },
    )
  }, [showFeedback, t])

  const showBindingLeaderboardDataMissing = useCallback(() => {
    showFeedback(
      t('team_react.bindingLeaderboardDataMissing', undefined, '\u6682\u65f6\u6ca1\u6709\u67e5\u5230\u5bf9\u5e94\u4fe1\u606f\uff0c\u53ef\u80fd\u662f\u4eca\u65e5\u521a\u6ce8\u518c\u3002'),
      'warning',
      { duration: 5000, placement: 'top' },
    )
  }, [showFeedback, t])

  const dismissFeedback = useCallback(() => {
    setFeedback(null)
  }, [])

  const loadLobby = useCallback(async () => {
    setLoading(true)
    try {
      const { teamTypes, teams, messages } = await getLobbySnapshot()
      setTeamTypes(teamTypes)
      setTeams(teams)
      setMessages(messages)
    } catch (err) {
      showFeedback(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [showFeedback])

  const loadTeamMessages = useCallback(async (teamId: number) => {
    setTeamMessages(await getTeamMessages(teamId))
  }, [])

  const loadUserData = useCallback(async () => {
    if (!currentUserId) {
      setUserTeams([])
      setTeamMessages([])
      setFriends([])
      setFriendRequests([])
      setBinding({ playerName: null })
      setGameBindings([])
      return
    }

    const { userTeams, friends, friendRequests, binding, gameBindings } = await getUserLobbySnapshot(currentUserId)
    setUserTeams(userTeams)
    setFriends(friends)
    setFriendRequests(friendRequests)
    setBinding(binding)
    setGameBindings(gameBindings)
  }, [currentUserId])

  const loadTeams = useCallback(async () => {
    const nextTeams = await getLobbyTeams()
    const teamById = new Map(nextTeams.map((team) => [team.id, team]))
    setTeams(nextTeams)
    setUserTeams((current) => {
      if (current.length === 0) return current
      return current.flatMap((team) => {
        const refreshedTeam = teamById.get(team.id)
        return refreshedTeam ? [refreshedTeam] : []
      })
    })
  }, [])

  const loadTeamTypes = useCallback(async () => {
    setTeamTypes(await getLobbyTeamTypes())
  }, [])

  const loadUserTeams = useCallback(async () => {
    setUserTeams(currentUserId ? await getUserTeams(currentUserId) : [])
  }, [currentUserId])

  const loadFriends = useCallback(async () => {
    setFriends(currentUserId ? await getUserFriends(currentUserId) : [])
  }, [currentUserId])

  const loadFriendRequests = useCallback(async () => {
    setFriendRequests(currentUserId ? await getUserFriendRequests(currentUserId) : [])
  }, [currentUserId])

  useEffect(() => {
    loadLobby()
  }, [loadLobby, locale])

  useEffect(() => {
    loadUserData().catch((err) => showFeedback(getErrorMessage(err)))
  }, [loadUserData, showFeedback])

  const typeById = useMemo(() => new Map(teamTypes.map((type) => [String(type.id), type.name])), [teamTypes])
  const activeTeamIds = useMemo(() => new Set(userTeams.map((team) => team.id)), [userTeams])
  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds])

  const loadTeamPanel = useCallback(
    async (team: Team) => {
      const requestId = selectedTeamRequestId.current + 1
      selectedTeamRequestId.current = requestId
      setSelectedTeam(team)
      try {
        const isLeader = user?.id !== undefined && Number(user.id) === Number(team.leader_id)
        const { members, applications } = await getTeamPanelSnapshot(
          team.id,
          isLeader ? user.id : undefined,
        )
        if (selectedTeamRequestId.current === requestId) {
          setMembers(members)
          setApplications(applications)
        }
      } catch (err) {
        if (selectedTeamRequestId.current === requestId) showFeedback(getErrorMessage(err))
      }
    },
    [showFeedback, user?.id],
  )

  const clearTeamPanel = useCallback(() => {
    selectedTeamRequestId.current += 1
    setSelectedTeam(null)
    setMembers([])
    setApplications([])
  }, [])

  const clearViewedTeam = useCallback(() => {
    viewedTeamRequestId.current += 1
    setViewedTeam(null)
    setViewedMembers([])
  }, [])

  const loadViewedTeam = useCallback(
    async (team: Team) => {
      const requestId = viewedTeamRequestId.current + 1
      viewedTeamRequestId.current = requestId
      setViewedTeam(team)
      setViewedMembers([])
      try {
        const { members } = await getTeamPanelSnapshot(team.id)
        if (viewedTeamRequestId.current === requestId) setViewedMembers(members)
      } catch (err) {
        if (viewedTeamRequestId.current === requestId) showFeedback(getErrorMessage(err))
      }
    },
    [showFeedback],
  )

  const selectTeamFromList = useCallback(
    async (team: Team) => {
      if (activeTeamIds.has(team.id)) {
        clearViewedTeam()
        await loadTeamPanel(team)
        return
      }

      await loadViewedTeam(team)
    },
    [activeTeamIds, clearViewedTeam, loadTeamPanel, loadViewedTeam],
  )

  useEffect(() => {
    if (viewedTeam) {
      const currentViewedTeam = teams.find((team) => team.id === viewedTeam.id)
      if (!currentViewedTeam) {
        clearViewedTeam()
      } else if (currentUserId && userTeams.some((team) => team.id === viewedTeam.id)) {
        clearViewedTeam()
      } else if (currentViewedTeam !== viewedTeam) {
        setViewedTeam(currentViewedTeam)
      }
    }

    if (!currentUserId) {
      clearTeamPanel()
      return
    }

    if (userTeams.length === 0) {
      clearTeamPanel()
      return
    }

    const currentSelectedTeam = selectedTeam && userTeams.find((team) => team.id === selectedTeam.id)
    if (!currentSelectedTeam) {
      void loadTeamPanel(userTeams[0])
      return
    }

    if (currentSelectedTeam !== selectedTeam) setSelectedTeam(currentSelectedTeam)
  }, [clearTeamPanel, clearViewedTeam, currentUserId, loadTeamPanel, selectedTeam, teams, userTeams, viewedTeam])

  useLobbyRealtime({
    selectedTeam,
    viewedTeam,
    currentUserId,
    activeTeamId: userTeams[0]?.id ?? null,
    joinedTeamIds: activeTeamIds,
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
    onTeamApplication: showTeamApplicationNotice,
    onTeamApplicationRejected: showTeamApplicationRejectedNotice,
  })

  const runAction = useCallback<RunAction>(
    async (task, message) => {
      try {
        await task()
        showFeedback(message, 'success')
        await Promise.all([loadLobby(), loadUserData(), selectedTeam ? loadTeamPanel(selectedTeam) : Promise.resolve()])
        return true
      } catch (err) {
        const errorMessage = getErrorMessage(err)
        showFeedback(
          errorMessage === 'Application already submitted'
            ? t('team_react.applicationAlreadySubmitted')
            : errorMessage,
        )
        return false
      }
    },
    [loadLobby, loadTeamPanel, loadUserData, selectedTeam, showFeedback, t],
  )

  return (
    <section className="page-grid">
      <aside className="side-panel">
        <AuthPanel
          user={user}
          loginWithQQ={loginWithQQ}
          loginLocal={loginLocal}
          binding={binding}
          gameBindings={gameBindings}
          runAction={runAction}
          onLeaderboardDataMissing={showBindingLeaderboardDataMissing}
        />

      </aside>

      <section className="main-stack">
        {feedback ? <Toast duration={feedback.duration} key={feedback.id} onDismiss={dismissFeedback} placement={feedback.placement} variant={feedback.variant}>{feedback.message}</Toast> : null}

        <TeamsPanel
          user={user}
          teams={teams}
          teamTypes={teamTypes}
          userTeams={userTeams}
          typeById={typeById}
          activeTeamIds={activeTeamIds}
          selectedTeam={selectedTeam}
          members={members}
          applications={applications}
          viewedTeam={viewedTeam}
          viewedMembers={viewedMembers}
          hasGameNameBinding={Boolean(binding.playerName)}
          loading={loading}
          runAction={runAction}
          onSelectTeam={selectTeamFromList}
          onSelectOwnedTeam={loadTeamPanel}
          onExitTeam={clearTeamPanel}
          onCloseViewedTeam={clearViewedTeam}
          onInviteCopied={showInviteCopied}
          onError={(message) => showFeedback(message)}
        />
      </section>

      <aside className="right-rail">
        <ChatChannelPanel
          user={user}
          messages={messages}
          setMessages={setMessages}
          teamMessages={teamMessages}
          setTeamMessages={setTeamMessages}
          userTeams={userTeams}
          hasGameNameBinding={Boolean(binding.playerName)}
          loadTeamMessages={loadTeamMessages}
          setError={(message) => {
            if (message) showFeedback(message)
          }}
        />
        <ConnectionsPanel
          user={user}
          setError={(message) => {
            if (message) showFeedback(message)
          }}
          friends={friends}
          onlineUserIds={onlineUserIdSet}
          requests={friendRequests}
          runAction={runAction}
          onDirectMessage={showDirectMessageNotice}
        />
      </aside>
    </section>
  )
}
