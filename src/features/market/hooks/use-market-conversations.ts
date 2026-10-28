import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/format'
import type { MarketConversation } from '@/lib/types'
import { createMarketConversation, getMarketConversations } from '../api/market-api'

export function useMarketConversations(token: string | null) {
  const [conversations, setConversations] = useState<MarketConversation[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setConversations([])
      setError(null)
      return
    }
    try {
      setError(null)
      setConversations(await getMarketConversations(token))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openConversation = useCallback(async (listingId: number) => {
    if (!token) throw new Error('Login is required')
    const conversation = await createMarketConversation(listingId, token)
    await refresh()
    return conversation
  }, [refresh, token])

  return { conversations, error, openConversation, refresh }
}
