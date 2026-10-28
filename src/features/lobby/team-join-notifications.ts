import { getStoredLocale, translate } from '@/lib/i18n'

const STORAGE_KEY = 'trovebbs.team-join-notifications.v1'
const DESKTOP_NOTIFICATION_STORAGE_KEY = 'trovebbs.team-join-desktop-notifications.v1'

export type BrowserNotificationPermission = NotificationPermission | 'unsupported'
export type TeamJoinSoundPermission = 'granted' | 'prompt' | 'unsupported'

export interface TeamJoinNotificationDetails {
  teamName: string
  memberName: string
}

export interface TeamApplicationNotificationDetails {
  teamName: string
}

let inMemoryEnabled = false
let audioContext: AudioContext | null = null

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

function canUseBrowserApis() {
  return typeof window !== 'undefined'
}

function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (!canUseBrowserApis() || !('Notification' in window)) return 'unsupported'
  return window.Notification.permission
}

export function isTeamJoinNotificationEnabled() {
  if (!canUseBrowserApis()) return false

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === null ? inMemoryEnabled : stored === 'enabled'
  } catch {
    return inMemoryEnabled
  }
}

export function isTeamDesktopNotificationEnabled() {
  if (!canUseBrowserApis()) return false

  try {
    const stored = window.localStorage.getItem(DESKTOP_NOTIFICATION_STORAGE_KEY)
    return stored === null ? getBrowserNotificationPermission() === 'granted' : stored === 'enabled'
  } catch {
    return getBrowserNotificationPermission() === 'granted'
  }
}

function getAudioContext() {
  if (!canUseBrowserApis()) return null
  if (audioContext?.state === 'closed') audioContext = null

  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext
  if (!AudioContextConstructor) return null

  audioContext ??= new AudioContextConstructor()
  return audioContext
}

export function prepareTeamJoinNotificationSound() {
  void requestTeamJoinNotificationSoundPermission()
}

export async function requestTeamJoinNotificationSoundPermission(): Promise<TeamJoinSoundPermission> {
  if (!canUseBrowserApis() || !(window.AudioContext ?? window.webkitAudioContext)) return 'unsupported'
  return await resumeTeamJoinNotificationSound() ? 'granted' : 'prompt'
}

async function resumeTeamJoinNotificationSound() {
  const context = getAudioContext()
  if (!context) return null

  if (context.state !== 'running') {
    try {
      await context.resume()
    } catch {
      return null
    }
  }

  return context.state === 'running' ? context : null
}

function playNotificationSound() {
  void resumeTeamJoinNotificationSound().then((context) => {
    if (!context) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const now = context.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.16)
    oscillator.frequency.setValueAtTime(880, now + 0.24)
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.4)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
    gain.gain.setValueAtTime(0.0001, now + 0.23)
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.25)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.45)
  })
}

export async function setTeamJoinNotificationEnabled(enabled: boolean): Promise<TeamJoinSoundPermission> {
  const soundPermission = enabled ? await requestTeamJoinNotificationSoundPermission() : 'granted'

  inMemoryEnabled = enabled
  if (canUseBrowserApis()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? 'enabled' : 'disabled')
    } catch {
      // The current tab can still use the in-memory preference when storage is blocked.
    }
  }

  return soundPermission
}

export function getTeamDesktopNotificationPermission() {
  return getBrowserNotificationPermission()
}

export async function setTeamDesktopNotificationEnabled(enabled: boolean) {
  let permission = getBrowserNotificationPermission()
  if (enabled && permission === 'default') {
    try {
      permission = await window.Notification.requestPermission()
    } catch {
      permission = getBrowserNotificationPermission()
    }
  }

  const nextEnabled = enabled && permission === 'granted'
  if (canUseBrowserApis()) {
    try {
      window.localStorage.setItem(DESKTOP_NOTIFICATION_STORAGE_KEY, nextEnabled ? 'enabled' : 'disabled')
    } catch {
      // Browser notifications still work for the current tab when preference storage is blocked.
    }
  }

  return { enabled: nextEnabled, permission }
}

export function notifyTeamMemberJoined({ teamName, memberName }: TeamJoinNotificationDetails) {
  if (!isTeamJoinNotificationEnabled()) return

  const locale = getStoredLocale()
  const title = translate(locale, 'team_react.memberJoinedNotificationTitle', undefined, '\u961f\u4f0d\u6709\u65b0\u6210\u5458')
  const body = translate(locale, 'team_react.memberJoinedNotificationBody', { member: memberName, team: teamName }, '{member} \u52a0\u5165\u4e86{team}')
  showBrowserNotification(title, body)
  playNotificationSound()
}

export function notifyTeamApplicationReceived({ teamName }: TeamApplicationNotificationDetails) {
  if (!isTeamJoinNotificationEnabled()) return

  const locale = getStoredLocale()
  const title = translate(locale, 'team_react.teamApplicationNotificationTitle', undefined, '\u961f\u4f0d\u6709\u65b0\u7533\u8bf7')
  const body = translate(locale, 'team_react.teamApplicationNotificationBody', { team: teamName }, '{team}\u6536\u5230\u4e86\u65b0\u7684\u5165\u961f\u7533\u8bf7')
  showBrowserNotification(title, body)
  playNotificationSound()
}

function showBrowserNotification(title: string, body: string) {
  if (!isTeamDesktopNotificationEnabled()) return

  const permission = getBrowserNotificationPermission()

  if (permission === 'granted') {
    try {
      new window.Notification(title, { body })
    } catch {
      // A browser may revoke notification access between the permission read and creation.
    }
  }
}
