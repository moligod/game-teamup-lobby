import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ListFilter, MessageCircle, Search, Store } from 'lucide-react'
import { getErrorMessage, isAbortError } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import { getLeaderboardPlayerProfile } from '@/features/leaderboard/api/leaderboard-api'
import { PlayerProfileDrawer } from '@/features/leaderboard/components/PlayerProfileDrawer'
import type { LeaderboardPlayerProfile, MarketListing, MarketListingInput, User } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'
import { useMarketListings } from '../hooks/use-market-listings'
import { useSellerMarketListings } from '../hooks/use-seller-market-listings'
import { useMarketConversations } from '../hooks/use-market-conversations'
import type { MarketCategoryId, SellerOffer } from '../types'
import { MarketCategoryNav } from './MarketCategoryNav'
import { MarketSafetyRail } from './MarketSafetyRail'
import { MarketSellForm } from './MarketSellForm'
import { SellerOfferCard } from './SellerOfferCard'
import { MarketChatWorkspace } from './MarketChatWorkspace'
import { SellerReviewPanel } from './SellerReviewPanel'
import '../market.css'

type MarketMode = 'browse' | 'sell' | 'messages'

const MARKET_PAGE_SIZE = 10

interface MarketViewProps {
  onlineUserIds: string[]
  user: User | null
  token: string | null
  loginWithQQ: () => Promise<void>
}

function listingToOffer(listing: MarketListing, isSellerOnline: boolean): SellerOffer {
  return {
    id: `listing-${listing.id}`,
    listingId: listing.id,
    sellerId: listing.seller_id,
    seller: listing.seller_name || `#${listing.seller_id}`,
    title: listing.title,
    delivery: listing.description,
    price: String(Number(listing.price)),
    priceUnit: listing.price_unit,
    stock: listing.stock,
    playerName: listing.player_name,
    averageRating: listing.average_rating ?? null,
    reviewCount: listing.review_count ?? 0,
    isSellerOnline,
    isFlux: listing.category === 'flux',
    category: listing.category,
    isPinned: Boolean(listing.is_pinned),
  }
}

export function MarketView({ onlineUserIds, user, token, loginWithQQ }: MarketViewProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<MarketMode>('browse')
  const [category, setCategory] = useState<MarketCategoryId>('flux')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [listingPage, setListingPage] = useState(1)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reviewOffer, setReviewOffer] = useState<SellerOffer | null>(null)
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [playerProfileOpen, setPlayerProfileOpen] = useState(false)
  const [playerProfileLoading, setPlayerProfileLoading] = useState(false)
  const [playerProfileError, setPlayerProfileError] = useState<string | null>(null)
  const [playerProfile, setPlayerProfile] = useState<LeaderboardPlayerProfile | null>(null)
  const playerProfileRequestId = useRef(0)
  const playerProfileRequestController = useRef<AbortController | null>(null)
  const {
    listings,
    total: totalListings,
    pageSize: listingPageSize,
    error: listingsError,
    loading: listingsLoading,
    refresh: refreshListings,
  } = useMarketListings(category, debouncedQuery, listingPage, MARKET_PAGE_SIZE)
  const {
    listings: sellerListings,
    error: sellerListingsError,
    refresh: refreshSellerListings,
    create: createListing,
    update: updateListing,
  } = useSellerMarketListings(token)
  const { conversations, error: conversationsError, openConversation, refresh: refreshConversations } = useMarketConversations(token)
  const onlineSellerIds = useMemo(() => new Set(onlineUserIds), [onlineUserIds])

  const offers = useMemo(() => {
    return [...listings]
      .filter((listing) => listing.category === category)
      .sort((left, right) => {
        const pinnedDifference = Number(Boolean(right.is_pinned)) - Number(Boolean(left.is_pinned))
        if (pinnedDifference !== 0) return pinnedDifference
        if (category === 'flux') {
          const priceDifference = Number(left.price) - Number(right.price)
          if (priceDifference !== 0) return priceDifference
        } else {
          const onlineDifference = Number(onlineSellerIds.has(String(right.seller_id))) - Number(onlineSellerIds.has(String(left.seller_id)))
          if (onlineDifference !== 0) return onlineDifference
        }
        const createdDifference = Date.parse(right.created_at ?? '') - Date.parse(left.created_at ?? '')
        return Number.isFinite(createdDifference) && createdDifference !== 0 ? createdDifference : right.id - left.id
      })
      .map((listing) => listingToOffer(listing, onlineSellerIds.has(String(listing.seller_id))))
  }, [category, listings, onlineSellerIds])
  const totalOfferPages = Math.max(1, Math.ceil(totalListings / listingPageSize))
  const currentOfferPage = Math.min(listingPage, totalOfferPages)
  const visibleOffers = offers

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setListingPage(1)
      setDebouncedQuery(query.trim())
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setListingPage((current) => Math.min(current, totalOfferPages))
  }, [totalOfferPages])

  const saveListing = useCallback(async (id: number | null, input: MarketListingInput) => {
    if (id === null) await createListing(input)
    else await updateListing(id, input)
    await Promise.all([refreshListings(), refreshSellerListings()])
  }, [createListing, refreshListings, refreshSellerListings, updateListing])

  const closePlayerProfile = useCallback(() => {
    playerProfileRequestId.current += 1
    playerProfileRequestController.current?.abort()
    playerProfileRequestController.current = null
    setPlayerProfileOpen(false)
    setPlayerProfileLoading(false)
    setPlayerProfileError(null)
    setPlayerProfile(null)
  }, [])

  const openPlayerProfile = useCallback(async (playerName: string) => {
    playerProfileRequestController.current?.abort()
    const controller = new AbortController()
    playerProfileRequestController.current = controller
    const requestId = playerProfileRequestId.current + 1
    playerProfileRequestId.current = requestId
    setPlayerProfileOpen(true)
    setPlayerProfileLoading(true)
    setPlayerProfileError(null)
    setPlayerProfile(null)
    try {
      const profile = await getLeaderboardPlayerProfile(playerName, controller.signal)
      if (playerProfileRequestId.current === requestId) setPlayerProfile(profile)
    } catch (err) {
      if (playerProfileRequestId.current === requestId && !isAbortError(err)) setPlayerProfileError(getErrorMessage(err))
    } finally {
      if (playerProfileRequestId.current === requestId) {
        playerProfileRequestController.current = null
        setPlayerProfileLoading(false)
      }
    }
  }, [])

  useEffect(() => () => playerProfileRequestController.current?.abort(), [])

  function chooseMode(nextMode: MarketMode) {
    setMode(nextMode)
    setActionError(null)
  }

  function chooseCategory(nextCategory: MarketCategoryId) {
    setCategory(nextCategory)
    setListingPage(1)
  }

  const startConversation = useCallback(async (offer: SellerOffer) => {
    if (!offer.listingId) return
    if (!token) {
      await loginWithQQ()
      return
    }
    try {
      setActionError(null)
      const conversation = await openConversation(offer.listingId)
      setActiveConversationId(conversation.id)
      setMode('messages')
    } catch (err) {
      const message = getErrorMessage(err)
      setActionError(message === 'You cannot open a conversation for your own listing'
        ? t('marketC2C.ownListingConversationForbidden', undefined, '\u4e0d\u80fd\u4e0e\u81ea\u5df1\u7684\u5546\u54c1\u53d1\u8d77\u6d3d\u8c08\u3002')
        : message)
    }
  }, [loginWithQQ, openConversation, token])

  return (
    <section className="market-page">
      <div className="market-header">
        <div>
          <span className="market-eyebrow"><Store size={15} /> {t('market.communityMarket')}</span>
          <h1>{mode === 'browse' ? t('market.title') : mode === 'sell' ? t('market.sellerCenter') : t('marketC2C.myChats', undefined, '我的洽谈')}</h1>
          <p>{mode === 'browse' ? t('market.subtitle') : mode === 'sell' ? t('market.publishSubtitle') : t('marketC2C.myChatsHint', undefined, '所有交易沟通仅对买卖双方可见。')}</p>
        </div>
        <div className="market-mode-switch" role="group" aria-label={t('market.modeSwitch')}>
          <button aria-pressed={mode === 'browse'} className={mode === 'browse' ? 'active' : ''} onClick={() => chooseMode('browse')} type="button">{t('market.buy')}</button>
          <button aria-pressed={mode === 'sell'} className={mode === 'sell' ? 'active' : ''} onClick={() => chooseMode('sell')} type="button">{t('market.sell')}</button>
          <button aria-pressed={mode === 'messages'} className={mode === 'messages' ? 'active' : ''} onClick={() => chooseMode('messages')} type="button"><MessageCircle size={15} /> {t('marketC2C.myChats', undefined, '我的洽谈')}</button>
        </div>
      </div>

      {mode === 'sell' ? (
        <MarketSellForm
          category={category}
          error={sellerListingsError}
          listings={sellerListings}
          loginWithQQ={loginWithQQ}
          onCategoryChange={setCategory}
          onSave={saveListing}
          t={t}
          user={user}
        />
      ) : mode === 'messages' ? (
        user && token ? <>{conversationsError ? <Notice variant="warning">{conversationsError}</Notice> : null}<MarketChatWorkspace activeConversationId={activeConversationId} conversations={conversations} onActiveConversationChange={setActiveConversationId} onRefreshConversations={refreshConversations} t={t} token={token} user={user} /></> : <Panel className="market-login-required"><MessageCircle size={22} /><h2>{t('marketC2C.loginToChatTitle', undefined, '登录后查看交易洽谈')}</h2><p>{t('marketC2C.loginToChatText', undefined, '使用 QQ 登录后，即可私聊卖家、接收买家消息并留下交易评价。')}</p><Button onClick={() => void loginWithQQ()} variant="primary">{t('marketSeller.loginButton')}</Button></Panel>
      ) : (
        <div className="market-browse-layout">
          <Panel as="div" className="market-category-panel"><MarketCategoryNav activeCategory={category} onSelect={chooseCategory} t={t} /></Panel>
          <div className="market-offers-column">
            <Panel as="div" className="market-toolbar">
              <div className="market-toolbar-title">
                <div className="market-toolbar-icon"><ListFilter size={18} /></div>
                <div><h2>{t(`market.categories.${category}`)}</h2><p>{t(`marketSeller.categoryDescriptions.${category}`)}</p></div>
              </div>
              <label className="market-search"><Search size={16} /><input maxLength={120} onChange={(event) => setQuery(event.target.value)} placeholder={t('marketSeller.searchPlaceholder')} value={query} /></label>
            </Panel>
            <div className="market-offers-main">
              <div className="market-offers-alert">{listingsError || actionError ? <Notice variant="warning">{actionError || listingsError}</Notice> : null}</div>
              {reviewOffer?.sellerId ? <div className="market-modal-backdrop" onMouseDown={() => setReviewOffer(null)}><SellerReviewPanel onClose={() => setReviewOffer(null)} sellerId={reviewOffer.sellerId} sellerName={reviewOffer.seller} t={t} /></div> : null}
              {playerProfileOpen ? <PlayerProfileDrawer error={playerProfileError} loading={playerProfileLoading} onClose={closePlayerProfile} profile={playerProfile} /> : null}
              <div className="market-offer-summary"><span>{t('market.listingCount', { count: totalListings })}</span><span>{category === 'flux' ? t('marketC2C.sortedByPrice', undefined, '按价格从低到高排序') : t('marketC2C.sortedByNewest', undefined, '按最新发布时间排序')}</span></div>
              <div className="seller-offer-list">
                {visibleOffers.map((offer) => <SellerOfferCard key={offer.id} offer={offer} onContact={startConversation} onViewPlayerProfile={openPlayerProfile} onViewReviews={setReviewOffer} t={t} />)}
                {!listingsLoading && offers.length === 0 ? <Panel className="market-empty"><h2>{t('market.emptyTitle')}</h2><p>{t('market.emptyText')}</p><Button onClick={() => { setQuery(''); setDebouncedQuery(''); setListingPage(1) }} variant="secondary">{t('market.clearFilters')}</Button></Panel> : null}
              </div>
              <div className="market-listing-pagination"><span>{t('market.listingPage', { page: currentOfferPage, total: totalOfferPages }, `第 ${currentOfferPage} / ${totalOfferPages} 页`)}</span><div><IconButton disabled={listingsLoading || currentOfferPage <= 1} label={t('leaderboard.previousPage')} onClick={() => setListingPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></IconButton><IconButton disabled={listingsLoading || currentOfferPage >= totalOfferPages} label={t('leaderboard.nextPage')} onClick={() => setListingPage((current) => Math.min(totalOfferPages, current + 1))}><ChevronRight size={16} /></IconButton></div></div>
            </div>
          </div>
          <Panel as="div" className="market-safety-panel"><MarketSafetyRail t={t} /></Panel>
        </div>
      )}
    </section>
  )
}
