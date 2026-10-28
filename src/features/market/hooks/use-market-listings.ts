import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage, isAbortError } from '@/lib/format'
import { getMarketListings } from '../api/market-api'
import type { MarketCategoryId, MarketListingPage } from '../types'

export function useMarketListings(category: MarketCategoryId, query: string, page: number, pageSize = 10) {
  const [result, setResult] = useState<MarketListingPage>({ items: [], total: 0, page: 1, page_size: pageSize })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const requestController = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    setLoading(true)
    try {
      setError(null)
      const nextResult = await getMarketListings(category, query, page, pageSize, controller.signal)
      if (requestController.current === controller) setResult(nextResult)
    } catch (err) {
      if (requestController.current === controller && !isAbortError(err)) setError(getErrorMessage(err))
    } finally {
      if (requestController.current === controller) setLoading(false)
    }
  }, [category, page, pageSize, query])

  useEffect(() => {
    void refresh()
    return () => {
      const controller = requestController.current
      controller?.abort()
      if (requestController.current === controller) requestController.current = null
    }
  }, [refresh])

  return {
    listings: result.items,
    total: result.total,
    page: result.page,
    pageSize: result.page_size,
    error,
    loading,
    refresh,
  }
}
