import { useEffect } from 'react'
import { subscribeWebSocket } from '@/lib/ws'
import { clearLeaderboardCache } from '../api/leaderboard-cache'

export function useLeaderboardRealtime(onLeaderboardUpdate: () => void) {
  useEffect(() => {
    return subscribeWebSocket((message) => {
      if (message.type !== 'leaderboard_update') return
      clearLeaderboardCache()
      onLeaderboardUpdate()
    })
  }, [onLeaderboardUpdate])
}
