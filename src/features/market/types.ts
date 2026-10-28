import type { MarketListing, MarketListingCategory } from '@/lib/types'

export type MarketCategoryId = MarketListingCategory

export interface MarketCategory {
  id: MarketCategoryId
  labelKey: string
  descriptionKey: string
}

export interface MarketListingPage {
  items: MarketListing[]
  total: number
  page: number
  page_size: number
}

export interface SellerOffer {
  id: string
  listingId?: number
  sellerId?: number
  category: MarketCategoryId
  seller: string
  title: string
  delivery: string
  price: string
  priceUnit: string
  stock: string
  playerName: string
  averageRating?: number | null
  reviewCount?: number
  isSellerOnline: boolean
  isFlux: boolean
  isPinned?: boolean
}
