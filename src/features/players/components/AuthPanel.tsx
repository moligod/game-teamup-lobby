import { useRef, useState } from 'react'
import { Link2, UserCheck } from 'lucide-react'
import { getLeaderboardPlayerProfile } from '@/features/leaderboard/api/leaderboard-api'
import { PlayerProfileDrawer } from '@/features/leaderboard/components/PlayerProfileDrawer'
import { bindPlayer, unbindPlayer } from '../api/player-api'
import type { RunAction } from '@/features/lobby/components/TeamsPanel'
import { ApiError } from '@/lib/api'
import { formatNumber, formatScore, getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { GameBinding, LeaderboardPlayerProfile, PlayerBinding, User } from '@/lib/types'
import { Button } from '@/shared/ui/Button'

export function AuthPanel({
  user,
  loginWithQQ,
  binding,
  gameBindings,
  runAction,
  onLeaderboardDataMissing,
}: {
  user: User | null
  loginWithQQ: () => Promise<void>
  binding: PlayerBinding
  gameBindings: GameBinding[]
  runAction: RunAction
  onLeaderboardDataMissing: () => void
}) {
  const { t } = useI18n()
  const [playerName, setPlayerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playerProfileOpen, setPlayerProfileOpen] = useState(false)
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false)
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null)
  const [playerProfile, setPlayerProfile] = useState<LeaderboardPlayerProfile | null>(null)
  const playerProfileRequestId = useRef(0)

  function compactMasteryLevel(value?: string | null) {
    const raw = value?.trim()
    if (!raw) return null
    return raw.match(/^Lv\s*\d+/i)?.[0] ?? raw
  }

  async function startQQLogin() {
    setBusy(true)
    setError(null)
    try {
      await loginWithQQ()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function closePlayerProfile() {
    playerProfileRequestId.current += 1
    setPlayerProfileOpen(false)
    setPlayerProfileLoading(false)
    setPlayerProfileError(null)
    setPlayerProfile(null)
  }

  async function openPlayerProfile() {
    if (!binding.playerName) return
    const requestId = playerProfileRequestId.current + 1
    playerProfileRequestId.current = requestId
    setPlayerProfileOpen(true)
    setPlayerProfileLoading(true)
    setPlayerProfileError(null)
    setPlayerProfile(null)
    try {
      const profile = await getLeaderboardPlayerProfile(binding.playerName)
      if (playerProfileRequestId.current === requestId) setPlayerProfile(profile)
    } catch (err) {
      if (playerProfileRequestId.current === requestId) setPlayerProfileError(getErrorMessage(err))
    } finally {
      if (playerProfileRequestId.current === requestId) setPlayerProfileLoading(false)
    }
  }

  if (user) {
    return (
      <div className="panel account-panel binding-only" id="login">
        <div className="account-binding">
          <div className="panel-title">
            <Link2 size={18} />
            {t('teamLobby.gameBinding')}
          </div>
          {!binding.playerName ? (
            <form
              className="form-stack"
              onSubmit={async (event) => {
                event.preventDefault()
                let leaderboardDataMissing = false
                await runAction(async () => {
                  const result = await bindPlayer(user.id, playerName)
                  try {
                    await getLeaderboardPlayerProfile(result.playerName ?? playerName)
                  } catch (error) {
                    if (error instanceof ApiError && error.status === 404) leaderboardDataMissing = true
                  }
                }, t('team_react.boundNotice'))
                setPlayerName('')
                if (leaderboardDataMissing) onLeaderboardDataMissing()
              }}
            >
              <label>
                {t('team_react.playerName')}
                <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder={t('team_react.playerNamePlaceholder')} />
              </label>
              <Button variant="primary" fullWidth type="submit" disabled={!playerName.trim()}>
                {t('common.bind')}
              </Button>
            </form>
          ) : null}
          {binding.playerName && <div className="binding-summary"><strong>{binding.playerName}</strong></div>}
          {binding.playerName ? (
            <div className="binding-actions">
              <Button variant="secondary" onClick={() => {
                closePlayerProfile()
                void runAction(() => unbindPlayer(user.id), t('team_react.unboundNotice'))
              }}>{t('team_react.unbindRole', undefined, '\u89e3\u7ed1\u89d2\u8272')}</Button>
            </div>
          ) : null}
          {playerProfileOpen ? <PlayerProfileDrawer error={playerProfileError} loading={playerProfileLoading} onClose={closePlayerProfile} profile={playerProfile} /> : null}
        </div>
      </div>
    )
  }

  return (
    <section className="panel qq-login-panel" id="login">
      <div className="panel-title">
        <UserCheck size={18} />
        {t('auth.qqLogin')}
      </div>
      <p className="qq-login-hint">{t('auth.qqLoginHint')}</p>
      <Button variant="default" className="qq-login-button" fullWidth loading={busy} onClick={startQQLogin} icon={<UserCheck size={18} />}>
        {busy ? t('common.processing') : t('auth.qqLoginButton')}
      </Button>
      {error ? <div className="inline-error">{error}</div> : null}
    </section>
  )
}
