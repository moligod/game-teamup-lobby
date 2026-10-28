import { get } from '@/lib/api'
import type { TrovePalAnnouncementPayload } from '@/lib/types'

export function getAnnouncementChannels() {
  return get<string[]>('/api/announcements/channels')
}

export function getAnnouncements(page: number, channelName: string | null, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), pageSize: '10' })
  if (channelName) params.set('channelName', channelName)
  return get<TrovePalAnnouncementPayload>(`/api/announcements?${params.toString()}`, undefined, { signal })
}
