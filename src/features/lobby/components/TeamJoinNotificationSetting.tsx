import { useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, Volume2, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n-react'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import {
  getTeamDesktopNotificationPermission,
  isTeamJoinNotificationEnabled,
  isTeamDesktopNotificationEnabled,
  prepareTeamJoinNotificationSound,
  requestTeamJoinNotificationSoundPermission,
  setTeamDesktopNotificationEnabled,
  setTeamJoinNotificationEnabled,
  type BrowserNotificationPermission,
  type TeamJoinSoundPermission,
} from '../team-join-notifications'

export function TeamJoinNotificationSetting() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(isTeamJoinNotificationEnabled)
  const [soundPermissionDialogOpen, setSoundPermissionDialogOpen] = useState(false)

  useEffect(() => {
    if (!enabled) return

    function unlockSound() {
      prepareTeamJoinNotificationSound()
    }

    window.addEventListener('pointerdown', unlockSound, { passive: true })
    window.addEventListener('keydown', unlockSound)
    return () => {
      window.removeEventListener('pointerdown', unlockSound)
      window.removeEventListener('keydown', unlockSound)
    }
  }, [enabled])

  async function handleChange(nextEnabled: boolean) {
    const soundPermission = await setTeamJoinNotificationEnabled(nextEnabled)
    setEnabled(nextEnabled)
    if (nextEnabled && soundPermission !== 'granted') setSoundPermissionDialogOpen(true)
  }

  const permissionNotice = t('team_react.memberJoinedNotificationHint', undefined, '\u6210\u5458\u52a0\u5165\u5f53\u524d\u961f\u4f0d\u65f6\u663e\u793a\u7f51\u9875\u901a\u77e5\u5e76\u64ad\u653e\u63d0\u793a\u97f3')

  return (
    <>
      <label
        className={enabled ? 'team-join-notification-setting enabled' : 'team-join-notification-setting'}
        title={permissionNotice}
      >
        <input checked={enabled} onChange={(event) => void handleChange(event.target.checked)} type="checkbox" />
        <BellRing aria-hidden="true" size={16} />
        <span>
          <strong>{t('team_react.memberJoinedNotification', undefined, '\u6210\u5458\u52a0\u5165\u63d0\u9192')}</strong>
          <small>{permissionNotice}</small>
        </span>
      </label>
      {soundPermissionDialogOpen ? <TeamJoinSoundPermissionDialog onClose={() => setSoundPermissionDialogOpen(false)} /> : null}
    </>
  )
}

export function TeamDesktopNotificationToggle() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(isTeamDesktopNotificationEnabled)
  const [permission, setPermission] = useState<BrowserNotificationPermission>(getTeamDesktopNotificationPermission)

  async function toggleDesktopNotifications() {
    const result = await setTeamDesktopNotificationEnabled(!enabled)
    setEnabled(result.enabled)
    setPermission(result.permission)
  }

  const label = enabled
    ? t('team_react.disableDesktopNotifications', undefined, '\u5173\u95ed\u684c\u9762\u901a\u77e5')
    : t('team_react.enableDesktopNotifications', undefined, '\u5f00\u542f\u684c\u9762\u901a\u77e5')
  const title = permission === 'denied'
    ? t('team_react.desktopNotificationsDenied', undefined, '\u6d4f\u89c8\u5668\u5df2\u62d2\u7edd\u684c\u9762\u901a\u77e5\u6743\u9650')
    : label

  return (
    <Button
      icon={enabled ? <BellOff size={15} /> : <Bell size={15} />}
      onClick={() => void toggleDesktopNotifications()}
      size="sm"
      title={title}
      variant="secondary"
    >
      {label}
    </Button>
  )
}

function TeamJoinSoundPermissionDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [permission, setPermission] = useState<TeamJoinSoundPermission>('prompt')

  async function authorizeSound() {
    const nextPermission = await requestTeamJoinNotificationSoundPermission()
    setPermission(nextPermission)
    if (nextPermission === 'granted') onClose()
  }

  const unsupported = permission === 'unsupported'
  const description = unsupported
    ? t('team_react.soundPermissionUnsupported', undefined, '\u5f53\u524d\u6d4f\u89c8\u5668\u4e0d\u652f\u6301\u7f51\u9875\u63d0\u793a\u97f3\u3002')
    : t('team_react.soundPermissionDescription', undefined, '\u8bf7\u70b9\u51fb\u6388\u6743\u58f0\u97f3\uff0c\u5141\u8bb8\u7f51\u9875\u64ad\u653e\u961f\u4f0d\u63d0\u793a\u97f3\u3002')

  return (
    <div className="team-detail-backdrop team-sound-permission-backdrop" onMouseDown={onClose}>
      <section aria-labelledby="team-sound-permission-title" aria-modal="true" className="panel team-sound-permission-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="team-sound-permission-dialog-head">
          <div>
            <h3 id="team-sound-permission-title">{t('team_react.soundPermissionTitle', undefined, '\u6682\u65e0\u58f0\u97f3\u6743\u9650')}</h3>
            <p>{description}</p>
          </div>
          <IconButton label={t('common.close', undefined, '\u5173\u95ed')} onClick={onClose} variant="ghost"><X size={18} /></IconButton>
        </div>
        <div className="team-sound-permission-dialog-actions">
          <Button disabled={unsupported} icon={<Volume2 size={16} />} onClick={() => void authorizeSound()} variant="primary">
            {t('team_react.authorizeSound', undefined, '\u6388\u6743\u58f0\u97f3')}
          </Button>
          <Button onClick={onClose} variant="secondary">{t('common.cancel', undefined, '\u53d6\u6d88')}</Button>
        </div>
      </section>
    </div>
  )
}
