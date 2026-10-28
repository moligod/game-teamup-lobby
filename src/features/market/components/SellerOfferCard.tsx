import { MARKET_CURRENCY } from '@/config/constants'
import { useEffect, useRef, useState } from 'react'
import { Eye, MessageCircle, Pin, Star } from 'lucide-react'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import type { SellerOffer } from '../types'

interface SellerOfferCardProps {
  offer: SellerOffer
  onContact?: (offer: SellerOffer) => void
  onViewPlayerProfile?: (playerName: string) => void
  onViewReviews?: (offer: SellerOffer) => void
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

function formatRating(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function itemPriceUnit(value: string) {
  return value === '千' || value === '万' || value === '个' ? value : '个'
}

interface ExpandableListingTextProps {
  collapseLabel: string
  detailsLabel: string
  text: string
  variant: 'title' | 'description'
}

function ExpandableListingText({ collapseLabel, detailsLabel, text, variant }: ExpandableListingTextProps) {
  const copyRef = useRef<HTMLSpanElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [isOverflowing, setIsOverflowing] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [text])

  useEffect(() => {
    const copy = copyRef.current
    const container = copy?.parentElement
    if (!copy || !container || expanded) return

    const measureOverflow = () => {
      setIsOverflowing(copy.scrollWidth > copy.clientWidth + 1)
    }

    measureOverflow()
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureOverflow)
    resizeObserver?.observe(container)
    window.addEventListener('resize', measureOverflow)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', measureOverflow)
    }
  }, [expanded, text])

  const content = (
    <>
      <span className="seller-offer-expandable-copy" ref={copyRef}>{text}</span>
      {isOverflowing ? (
        <button
          aria-expanded={expanded}
          className="seller-offer-expandable-button"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded ? collapseLabel : detailsLabel}
        </button>
      ) : null}
    </>
  )
  const className = `seller-offer-expandable seller-offer-expandable-${variant}${expanded ? ' expanded' : ''}`

  return variant === 'title'
    ? <h3 className={className}>{content}</h3>
    : <div className={className}>{content}</div>
}

export function SellerOfferCard({ offer, onContact, onViewPlayerProfile, onViewReviews, t }: SellerOfferCardProps) {
  const hasRating = (offer.reviewCount ?? 0) > 0 && offer.averageRating !== null && offer.averageRating !== undefined
  const collapseLabel = t('marketC2C.collapse', undefined, '收起')
  const detailsLabel = t('marketC2C.details', undefined, '详情')
  const isAccount = offer.category === 'accounts'
  const priceWithCurrency = `${offer.price} ${MARKET_CURRENCY}`
  const displayPrice = offer.isFlux ? `${priceWithCurrency}${offer.priceUnit === 'per_million' ? ' / 1M' : ''}` : offer.category === 'items' ? `${priceWithCurrency} / ${itemPriceUnit(offer.priceUnit)}` : priceWithCurrency
  return (
    <article className={offer.isPinned ? 'seller-offer-card pinned' : 'seller-offer-card'}>
      <div className="seller-offer-seller">
        <div className="seller-avatar" aria-hidden="true">{offer.seller.slice(0, 1)}</div>
        <div>
          <div className="seller-name-line">
            <strong>{offer.seller}</strong>
          </div>
          <span className={offer.isSellerOnline ? 'seller-presence online' : 'seller-presence'}><i /> {offer.isSellerOnline ? t('market.online') : t('market.offline')}</span>
        </div>
      </div>
      <div className="seller-offer-main">
        <div className="seller-offer-title-line">
          <ExpandableListingText collapseLabel={collapseLabel} detailsLabel={detailsLabel} text={offer.title} variant="title" />
          {offer.isPinned ? <Badge icon={<Pin size={13} />} tone="info">{t('market.pinned', undefined, '\u7f6e\u9876')}</Badge> : null}
        </div>
        {offer.delivery || (isAccount && offer.playerName) ? <div className="seller-offer-meta">{isAccount && offer.playerName ? <span>{t('team_react.playerName', undefined, '游戏名')}: {offer.playerName}</span> : null}{offer.delivery ? <ExpandableListingText collapseLabel={collapseLabel} detailsLabel={detailsLabel} text={offer.delivery} variant="description" /> : null}</div> : null}
      </div>
      <div className="seller-offer-rating">
        {hasRating ? <span className="seller-offer-rating-score"><Star fill="currentColor" size={14} /> {t('marketC2C.ratingOutOfFive', { rating: formatRating(offer.averageRating!) }, `${formatRating(offer.averageRating!)} / 5 分`)}</span> : <span>{t('marketC2C.noRating', undefined, '暂无评分')}</span>}
        {onViewReviews ? <button onClick={() => onViewReviews(offer)} type="button">{t('marketC2C.viewReviews', undefined, '查看评价')}</button> : null}
      </div>
      <div className="seller-offer-price"><strong>{displayPrice}</strong>{offer.category !== 'accounts' ? <small>{offer.isFlux ? t('marketC2C.remainingStock', { stock: offer.stock }, `剩余库存 ${offer.stock}`) : t('marketC2C.remainingStock', { stock: offer.stock }, `剩余库存 ${offer.stock}`)}</small> : null}</div>
      {(isAccount && offer.playerName && onViewPlayerProfile) || (offer.listingId && onContact) ? <div className="seller-offer-actions">{isAccount && offer.playerName && onViewPlayerProfile ? <Button className="seller-offer-profile-action" icon={<Eye size={15} />} onClick={() => onViewPlayerProfile(offer.playerName)} size="sm" variant="secondary">{t('marketC2C.accountDetails', undefined, '账号详情')}</Button> : null}{offer.listingId && onContact ? <Button className="seller-offer-action" icon={<MessageCircle size={16} />} onClick={() => onContact(offer)} size="sm" variant="primary">{t('market.contactSeller')}</Button> : null}</div> : null}
    </article>
  )
}
