import { apiRequest, get, post, put } from '@/lib/api'
import type { DishonestyReport, DishonestyReportPage, MarketConversation, MarketConversationMessage, MarketListing, MarketListingInput, MarketReview } from '@/lib/types'
import type { MarketCategoryId, MarketListingPage } from '../types'

export function getMarketListings(category: MarketCategoryId, query: string, page: number, limit: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    category,
    query,
    page: String(page),
    limit: String(limit),
  })
  return get<MarketListingPage>(`/api/market/listings?${params}`, undefined, { signal })
}

export function getDishonestyReports(query: string, page: number) {
  return get<DishonestyReportPage>(`/api/market/dishonesty-reports?query=${encodeURIComponent(query)}&page=${page}&limit=10`)
}

export function createDishonestyReport(
  input: { dishonest_qq?: string; dishonest_player_name?: string; reason: string; evidence_urls: string[] },
  token: string,
) {
  return post<DishonestyReport>('/api/market/dishonesty-reports', input, token)
}

export function getMyMarketListings(token: string) {
  return get<MarketListing[]>('/api/market/listings/mine', token)
}

export function createMarketListing(input: MarketListingInput, token: string) {
  return post<MarketListing>('/api/market/listings', input, token)
}

export function updateMarketListing(id: number, input: MarketListingInput, token: string) {
  return put<MarketListing>(`/api/market/listings/${id}`, input, token)
}

export function getMarketConversations(token: string) {
  return get<MarketConversation[]>('/api/market/conversations', token)
}

export function createMarketConversation(listingId: number, token: string) {
  return post<MarketConversation>('/api/market/conversations', { listing_id: listingId }, token)
}

export function getMarketConversationMessages(conversationId: number, token: string, signal?: AbortSignal) {
  return get<MarketConversationMessage[]>(`/api/market/conversations/${conversationId}/messages`, token, { signal })
}

export function sendMarketConversationMessage(conversationId: number, body: string, token: string) {
  return post<MarketConversationMessage>(`/api/market/conversations/${conversationId}/messages`, { body }, token)
}

export function getSellerMarketReviews(sellerId: number) {
  return get<MarketReview[]>(`/api/market/sellers/${sellerId}/reviews`)
}

export function createMarketReview(
  input: { conversation_id: number; rating: 1 | 2 | 3 | 4 | 5; comment: string; image_urls: string[] },
  token: string,
) {
  return post<MarketReview>('/api/market/reviews', input, token)
}

export async function uploadMarketReviewImages(files: File[], token: string) {
  const body = new FormData()
  files.forEach((file) => body.append('files', file))
  const uploaded = await apiRequest<Array<{ url: string }>>('/api/market/uploads/review-images', {
    method: 'POST',
    body,
    token,
  })
  return uploaded.map((file) => file.url)
}

export async function uploadDishonestyEvidence(files: File[], token: string) {
  const body = new FormData()
  files.forEach((file) => body.append('files', file))
  const uploaded = await apiRequest<Array<{ url: string }>>('/api/market/uploads/dishonesty-evidence', {
    method: 'POST',
    body,
    token,
  })
  return uploaded.map((file) => file.url)
}
