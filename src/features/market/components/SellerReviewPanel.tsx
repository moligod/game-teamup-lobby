import { Image, Star, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getErrorMessage } from '@/lib/format'
import type { MarketReview } from '@/lib/types'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'
import { getSellerMarketReviews } from '../api/market-api'

interface SellerReviewPanelProps {
  sellerId: number
  sellerName: string
  onClose?: () => void
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

export function SellerReviewPanel({ sellerId, sellerName, onClose, t }: SellerReviewPanelProps) {
  const [reviews, setReviews] = useState<MarketReview[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getSellerMarketReviews(sellerId)
      .then((items) => {
        if (active) {
          setReviews(items)
          setError(null)
        }
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err))
      })
    return () => { active = false }
  }, [sellerId])

  return (
    <Panel aria-modal={onClose ? 'true' : undefined} as="section" className={onClose ? 'market-review-panel market-modal' : 'market-review-panel'} onMouseDown={(event) => event.stopPropagation()} role={onClose ? 'dialog' : undefined}>
      <div className="market-review-heading">
        <div><h2>{t('marketC2C.sellerReviews', { seller: sellerName }, `${sellerName} 的买家评价`)}</h2><p>{t('marketC2C.reviewHint', undefined, '评价来自已发起站内洽谈的买家。')}</p></div>
        {onClose ? <IconButton label={t('common.close', undefined, '关闭')} onClick={onClose}><X size={17} /></IconButton> : null}
      </div>
      {error ? <Notice variant="error">{error}</Notice> : null}
      <div className="market-review-list">
        {reviews.map((review) => (
          <article className="market-review-item" key={review.id}>
            <div className="market-review-meta">
              <strong>{review.buyer_name}</strong>
              <span className="market-review-score"><Star fill="currentColor" size={14} /> {t('marketC2C.ratingOutOfFive', { rating: review.rating }, `${review.rating} / 5 分`)}</span>
            </div>
            <p>{review.comment}</p>
            {review.image_urls.length > 0 ? <div className="market-review-images">{review.image_urls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank"><img alt={t('marketC2C.reviewImage', undefined, '买家留言图片')} loading="lazy" src={url} /></a>)}</div> : null}
          </article>
        ))}
        {reviews.length === 0 && !error ? <div className="market-review-empty"><Image size={18} /><span>{t('marketC2C.noReviews', undefined, '暂时没有买家留言。')}</span></div> : null}
      </div>
    </Panel>
  )
}
