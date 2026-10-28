import { get } from '@/lib/api'
import type { Stats } from '@/lib/types'

export function getPresenceStats() {
  return get<Stats>('/api/stats')
}

export function getOnlineUserIds() {
  return get<{ online_user_ids?: string[] }>('/api/online-users')
}
