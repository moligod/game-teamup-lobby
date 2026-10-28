import { useEffect, useRef, useState } from 'react'
import { BellRing, Check, Copy, Eye, LockKeyhole, UserCheck, X } from 'lucide-react'
import {
  applyToTeam,
  endTeam,
  joinTeam,
  leaveTeam,
  processTeamApplication,
} from '../api/lobby-api'
import { formatNumber } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import { copyText } from '@/lib/clipboard'
import { getLeaderboardPlayerProfile } from '@/features/leaderboard/api/leaderboard-api'
import { PlayerProfileDrawer } from '@/features/leaderboard/components/PlayerProfileDrawer'
import type { LeaderboardPlayerProfile, Team, TeamApplication, TeamMember, TeamType, User } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Badge } from '@/shared/ui/Badge'
import { CreateTeamPanel } from './CreateTeamPanel'
import { TeamDesktopNotificationToggle, TeamJoinNotificationSetting } from './TeamJoinNotificationSetting'

export type RunAction = (task: () => Promise<unknown>, message: string) => Promise<boolean>

export function TeamsPanel(props: {
  user: User | null
  teams: Team[]
  teamTypes: TeamType[]
  userTeams: Team[]
  typeById: Map<string, string>
  activeTeamIds: Set<number>
  selectedTeam: Team | null
  members: TeamMember[]
  applications: TeamApplication[]
  viewedTeam: Team | null
  viewedMembers: TeamMember[]
  hasGameNameBinding: boolean
  loading: boolean
  runAction: RunAction
  onSelectTeam: (team: Team) => Promise<void>
  onSelectOwnedTeam: (team: Team) => Promise<void>
  onExitTeam: () => void
  onCloseViewedTeam: () => void
  onInviteCopied: () => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const hasActiveTeam = props.userTeams.length > 0
  const hasGameNameBinding = props.hasGameNameBinding
  const currentUserId = props.user?.id ?? null
  const teamsForList = getTeamsForList(props.teams)
  const loginFirstNotice = t('team_react.loginFirst')
  const gameNameBindingNotice = t(
    'team_react.gameNameBindingRequired',
    undefined,
    '\u8bf7\u5148\u7ed1\u5b9a\u6e38\u620f\u540d\uff0c\u5426\u5219\u65e0\u6cd5\u52a0\u5165\u3001\u7533\u8bf7\u6216\u4f7f\u7528\u961f\u5185\u804a\u5929\u3002',
  )

  async function joinSelectedTeam(team: Team) {
    if (!currentUserId) {
      props.onError(loginFirstNotice)
      return
    }

    const joined = await props.runAction(
      () => joinTeam(team.id, currentUserId),
      t('team_react.joinedNotice'),
    )
    if (joined) await props.onSelectOwnedTeam(team)
  }

  return (
    <div className="team-stack">
      <section aria-live="polite" className="panel team-detail-panel">
        {props.selectedTeam ? (
          <JoinedTeamDetail
            applications={props.applications}
            members={props.members}
            runAction={props.runAction}
            team={props.selectedTeam}
            typeName={props.typeById.get(String(props.selectedTeam.team_type)) ?? props.selectedTeam.team_type}
            user={props.user}
            onExitTeam={props.onExitTeam}
            onInviteCopied={props.onInviteCopied}
            onError={props.onError}
          />
        ) : (
          <CreateTeamPanel
            onCreated={props.onSelectOwnedTeam}
            runAction={props.runAction}
            teamTypes={props.teamTypes}
            user={props.user}
          />
        )}
      </section>

      <section className="panel table-panel team-browser-panel">
        <section className="team-browser-list">
          <div className="section-head team-list-head">
            <div className="team-list-title">
              <h2 className="nowrap-title">{t('team.team_list')}</h2>
              <Badge>{formatNumber(teamsForList.length)}</Badge>
            </div>
          </div>

          <div className="team-browser-list-body">
            {props.loading ? <div className="empty">{t('common.loading')}</div> : null}
            {teamsForList.length === 0 && !props.loading ? <div className="empty">{t('team.no_teams')}</div> : null}
            {teamsForList.length > 0 && !props.loading ? <div className="team-list team-card-list">
              {teamsForList.map((team) => {
                const isJoined = props.activeTeamIds.has(team.id)
                const isEnded = team.status === 'ended'
                const isFull = team.current_members >= team.max_members
                const needsApproval = Boolean(team.requires_approval)
                const isSelected = props.selectedTeam?.id === team.id || props.viewedTeam?.id === team.id
                const requiresGameNameBinding = Boolean(props.user) && !hasGameNameBinding
                const pendingApplicationCount = isTeamLeader(team, currentUserId) ? team.pending_applications ?? 0 : 0
                return (
                  <article
                    aria-pressed={isSelected}
                    className={['team-card', isJoined ? 'joined' : '', isEnded ? 'ended' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ')}
                    key={team.id}
                    onClick={() => void props.onSelectTeam(team)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void props.onSelectTeam(team)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    >
                      <div className="team-card-main">
                        <div className="team-card-heading">
                          <span className="team-card-type">{props.typeById.get(String(team.team_type)) ?? team.team_type}</span>
                          {needsApproval ? <span className="team-approval-chip">{t('team.requires_approval', undefined, '\u9700\u8981\u5ba1\u6838')}</span> : null}
                        </div>
                        <strong>{team.name}</strong>
                      </div>

                    <div className="team-card-meta">
                      <span className="team-card-leader">{t('team_react.captain')}: {team.leader_name ?? team.leader_id}</span>
                      <div className="team-card-stats">
                        <span>{t('team_react.membersShort', undefined, '\u6210\u5458')} <strong>{team.current_members}/{team.max_members}</strong></span>
                        <span>{team.min_combat_power ? `${formatNumber(team.min_combat_power)}+` : t('team_react.noPowerRequirement')}</span>
                      </div>
                    </div>

                    <div className="team-card-actions">
                      {pendingApplicationCount > 0 ? <Badge className="team-pending-applications-badge" icon={<BellRing size={13} />} title={t('team_react.pendingReview')} tone="warning">{pendingApplicationCount}</Badge> : null}
                      {isJoined ? (
                        <span className="team-role-chip"><UserCheck size={14} />{t('team_react.joinedNotice')}</span>
                      ) : isEnded ? (
                        <span className="team-ended-chip">{t('team.ended')}</span>
                      ) : (
                        <span
                          className={requiresGameNameBinding ? 'team-card-action-lock' : undefined}
                          onClick={requiresGameNameBinding ? (event) => {
                            event.stopPropagation()
                            props.onError(gameNameBindingNotice)
                          } : undefined}
                          title={requiresGameNameBinding ? gameNameBindingNotice : undefined}
                        >
                          <Button
                            disabled={requiresGameNameBinding || hasActiveTeam || isFull}
                            icon={!props.user || requiresGameNameBinding ? <LockKeyhole size={15} /> : undefined}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (!props.user) {
                                props.onError(loginFirstNotice)
                                return
                              }
                              if (needsApproval) {
                                void props.runAction(
                                  () => applyToTeam(team.id, currentUserId!),
                                  t('team_react.appliedNotice', undefined, '\u7533\u8bf7\u5df2\u63d0\u4ea4'),
                                )
                                return
                              }
                              void joinSelectedTeam(team)
                            }}
                            title={!props.user ? loginFirstNotice : requiresGameNameBinding ? gameNameBindingNotice : undefined}
                            variant="primary"
                          >
                            {isFull ? t('team_react.fullTeam', undefined, '\u5df2\u6ee1\u5458') : needsApproval ? t('team_react.applyJoin', undefined, '\u7533\u8bf7\u52a0\u5165') : t('team.join')}
                          </Button>
                        </span>
                      )}
                    </div>
                  </article>
                )
              })}
            </div> : null}
          </div>
        </section>
      </section>
      {props.viewedTeam ? (
        <ViewedTeamDialog
          members={props.viewedMembers}
          team={props.viewedTeam}
          typeName={props.typeById.get(String(props.viewedTeam.team_type)) ?? props.viewedTeam.team_type}
          onClose={props.onCloseViewedTeam}
          onError={props.onError}
          onInviteCopied={props.onInviteCopied}
        />
      ) : null}
    </div>
  )
}

function getTeamsForList(teams: Team[]) {
  const activeTeams: Team[] = []
  const endedTeams: Team[] = []

  for (const team of teams) {
    if (team.status === 'ended') endedTeams.push(team)
    else activeTeams.push(team)
  }

  if (activeTeams.length >= 20) return activeTeams
  return [...activeTeams, ...endedTeams.slice(0, 20 - activeTeams.length)]
}

function ViewedTeamDialog({
  members,
  team,
  typeName,
  onClose,
  onInviteCopied,
  onError,
}: {
  members: TeamMember[]
  team: Team
  typeName: string
  onClose: () => void
  onInviteCopied: () => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="team-detail-backdrop" onMouseDown={onClose}>
      <section aria-modal="true" className="panel team-detail-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="team-detail-head team-detail-dialog-head">
          <div>
            <span className="team-detail-kicker">{t('team_react.teamDetail', undefined, '\u961f\u4f0d\u8be6\u60c5')}</span>
            <h3>{team.name}</h3>
          </div>
          <div className="team-detail-dialog-actions">
            <span className="team-card-type">{typeName}</span>
            <IconButton label={t('common.close', undefined, '\u5173\u95ed')} onClick={onClose} variant="ghost"><X size={18} /></IconButton>
          </div>
        </div>
        <TeamMetrics team={team} />
        <TeamMembers members={members} onError={onError} onInviteCopied={onInviteCopied} />
      </section>
    </div>
  )
}

function JoinedTeamDetail({
  applications,
  members,
  runAction,
  team,
  typeName,
  user,
  onExitTeam,
  onInviteCopied,
  onError,
}: {
  applications: TeamApplication[]
  members: TeamMember[]
  runAction: RunAction
  team: Team
  typeName: string
  user: User | null
  onExitTeam: () => void
  onInviteCopied: () => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const isLeader = isTeamLeader(team, user?.id)
  const [applicationsOpen, setApplicationsOpen] = useState(false)
  const canReviewApplications = isLeader && (team.requires_approval || applications.length > 0)

  async function exitTeam() {
    if (!user) return

    const exited = await runAction(
      () => isLeader ? endTeam(team.id, user.id) : leaveTeam(team.id, user.id),
      isLeader
        ? t('team_react.endNotice', undefined, '\u961f\u4f0d\u5df2\u7ed3\u675f')
        : t('team_react.leftNotice'),
    )
    if (exited) onExitTeam()
  }

  return (
    <div className="team-browser-detail-content">
      <div className="team-detail-head">
        <div className="team-detail-title-row">
          <span className="team-card-type">{typeName}</span>
          <h3>{team.name}</h3>
        </div>
        <div className="team-detail-head-actions">
          {canReviewApplications ? (
            <Button
              aria-controls="team-applications-dialog"
              aria-expanded={applicationsOpen}
              aria-haspopup="dialog"
              className="team-applications-trigger"
              icon={<BellRing size={15} />}
              onClick={() => setApplicationsOpen(true)}
              size="sm"
              variant="secondary"
            >
              {t('team_react.pendingReview')}
              <Badge tone={applications.length > 0 ? 'warning' : 'neutral'}>{applications.length}</Badge>
            </Button>
          ) : null}
          <TeamJoinNotificationSetting />
          <TeamDesktopNotificationToggle />
          {user ? (
            isLeader ? (
              <Button
                onClick={() => void exitTeam()}
                size="sm"
                variant="danger"
              >
                {t('team.end_team')}
              </Button>
            ) : (
              <Button
                onClick={() => void exitTeam()}
                size="sm"
                variant="secondary"
              >
                {t('team.leave')}
              </Button>
            )
          ) : null}
        </div>
      </div>
      <TeamMetrics team={team} />
      <TeamMembers members={members} onError={onError} onInviteCopied={onInviteCopied} />
      {applicationsOpen && isLeader && user ? (
        <TeamApplicationsDialog
          applications={applications}
          onClose={() => setApplicationsOpen(false)}
          runAction={runAction}
          user={user}
        />
      ) : null}
    </div>
  )
}

function TeamMetrics({ team }: { team: Team }) {
  const { t } = useI18n()

  return (
    <div className="team-browser-metrics">
      <span>
        <small>{t('team_react.membersShort', undefined, '\u6210\u5458')}</small>
        <b>{team.current_members}/{team.max_members}</b>
      </span>
      <span>
        <small>{t('team_react.powerRequirement', undefined, '\u6218\u529b')}</small>
        <b>{team.min_combat_power ? `${formatNumber(team.min_combat_power)}+` : t('team_react.noPowerRequirement')}</b>
      </span>
    </div>
  )
}

function TeamMembers({
  members,
  onInviteCopied,
  onError,
}: {
  members: TeamMember[]
  onInviteCopied: () => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [playerProfileOpen, setPlayerProfileOpen] = useState(false)
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false)
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null)
  const [playerProfile, setPlayerProfile] = useState<LeaderboardPlayerProfile | null>(null)
  const playerProfileRequestId = useRef(0)

  function closePlayerProfile() {
    playerProfileRequestId.current += 1
    setPlayerProfileOpen(false)
    setPlayerProfileLoading(false)
    setPlayerProfileError(null)
    setPlayerProfile(null)
  }

  async function openPlayerProfile(playerName: string) {
    const requestId = playerProfileRequestId.current + 1
    playerProfileRequestId.current = requestId
    setPlayerProfileOpen(true)
    setPlayerProfileLoading(true)
    setPlayerProfileError(null)
    setPlayerProfile(null)
    try {
      const profile = await getLeaderboardPlayerProfile(playerName)
      if (playerProfileRequestId.current === requestId) setPlayerProfile(profile)
    } catch (error) {
      if (playerProfileRequestId.current === requestId) {
        setPlayerProfileError(error instanceof Error ? error.message : t('common.operation_failed'))
      }
    } finally {
      if (playerProfileRequestId.current === requestId) setPlayerProfileLoading(false)
    }
  }

  async function inviteMember(playerName: string) {
    try {
      await copyText(playerName)
      onInviteCopied()
    } catch {
      onError(t('team_react.copyInviteFailed', undefined, '\u590d\u5236\u9080\u8bf7\u6307\u4ee4\u5931\u8d25'))
    }
  }

  return (
    <div className="team-browser-members">
      <h4>{t('team_react.membersShort', undefined, '\u6210\u5458')}</h4>
      {members.length === 0 ? <p className="muted">{t('common.loading')}</p> : null}
      <div className="member-list">
        {members.map((member) => (
          <div className="mini-item team-member-item" key={member.id}>
            <strong className="team-member-name">{member.username}</strong>
            <div className="team-member-meta">
              <span>{member.role === 'leader' ? t('team.leader') : t('team.member')}</span>
              <small>{member.player_name ?? t('team_react.noGameNameBinding', undefined, '\u672a\u7ed1\u5b9a\u6e38\u620f\u540d')}</small>
            </div>
            <div className="row-actions team-member-actions">
              <Button disabled={!member.player_name} icon={<Copy size={15} />} size="sm" title={t('team_react.inviteMember', undefined, '\u9080\u8bf7\u6307\u4ee4')} onClick={() => member.player_name && void inviteMember(member.player_name)}>
                {t('team_react.inviteMember', undefined, '\u9080\u8bf7\u6307\u4ee4')}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {playerProfileOpen ? <PlayerProfileDrawer error={playerProfileError} loading={playerProfileLoading} onClose={closePlayerProfile} profile={playerProfile} /> : null}
    </div>
  )
}

function TeamApplicationsDialog({
  applications,
  onClose,
  runAction,
  user,
}: {
  applications: TeamApplication[]
  onClose: () => void
  runAction: RunAction
  user: User
}) {
  const { t } = useI18n()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="team-detail-backdrop team-applications-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="team-applications-dialog-title"
        aria-modal="true"
        className="panel team-applications-dialog"
        id="team-applications-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="team-applications-dialog-head">
          <div>
            <h3 id="team-applications-dialog-title">{t('team_react.pendingReview')}</h3>
            <p>{t('team_react.pendingReviewHint', undefined, '\u8bf7\u9009\u62e9\u540c\u610f\u6216\u62d2\u7edd\u5904\u7406\u5165\u961f\u7533\u8bf7\u3002')}</p>
          </div>
          <div className="team-applications-dialog-actions">
            <Badge icon={<BellRing size={14} />} tone="warning">{applications.length}</Badge>
            <IconButton label={t('common.close', undefined, '\u5173\u95ed')} onClick={onClose} variant="ghost"><X size={18} /></IconButton>
          </div>
        </div>
        <TeamApplications applications={applications} runAction={runAction} user={user} />
      </section>
    </div>
  )
}

function TeamApplications({
  applications,
  runAction,
  user,
}: {
  applications: TeamApplication[]
  runAction: RunAction
  user: User
}) {
  const { t } = useI18n()

  return (
    <section className="application-list team-application-list">
      <div className="team-application-heading">
        <div>
          <h4>{t('team_react.pendingReview')}</h4>
          <p>{t('team_react.pendingReviewHint', undefined, '请选择同意或拒绝处理入队申请。')}</p>
        </div>
        <Badge icon={<BellRing size={14} />} tone="warning">{applications.length}</Badge>
      </div>
      {applications.length === 0 ? <p className="team-application-empty">{t('team_react.pendingReviewEmpty', undefined, '\u6682\u65e0\u5f85\u5ba1\u6838\u7533\u8bf7')}</p> : null}
      {applications.map((application) => (
        <div className="mini-item" key={application.id}>
          <div>
            <strong>{application.username}</strong>
            <span>{application.player_name || t('team_react.noGameNameBinding')}</span>
          </div>
          <div className="row-actions">
            <Button icon={<Check size={15} />} onClick={() => void runAction(() => processTeamApplication(application.id, user.id, 'approve'), t('team_react.approveNotice'))} size="sm">
              {t('common.approve')}
            </Button>
            <Button icon={<X size={15} />} onClick={() => void runAction(() => processTeamApplication(application.id, user.id, 'reject'), t('team_react.rejectNotice'))} size="sm" variant="danger">
              {t('common.reject')}
            </Button>
          </div>
        </div>
      ))}
    </section>
  )
}

function isTeamLeader(team: Team, userId: number | null | undefined) {
  return userId !== null && userId !== undefined && Number(team.leader_id) === Number(userId)
}
