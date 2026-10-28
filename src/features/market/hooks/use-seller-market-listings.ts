import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/format'
import type { MarketListing, MarketListingInput } from '@/lib/types'
import { createMarketListing, getMyMarketListings, updateMarketListing } from '../api/market-api'

export function useSellerMarketListings(token: string | null) {
  const [listings, setListings] = useState<MarketListing[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!token) {
      setListings([])
      setError(null)
      return
    }
    try {
      setError(null)
      setListings(await getMyMarketListings(token))
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }, [token])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback(async (input: MarketListingInput) => {
    if (!token) throw new Error('Login is required')
    return createMarketListing(input, token)
  }, [token])

  const update = useCallback(async (id: number, input: MarketListingInput) => {
    if (!token) throw new Error('Login is required')
    return updateMarketListing(id, input, token)
  }, [token])

  return { listings, error, refresh, create, update }
}
