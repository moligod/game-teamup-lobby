import { type ChangeEvent, type FormEvent, useState } from 'react'
import { ImagePlus, Star, X } from 'lucide-react'
import { getErrorMessage } from '@/lib/format'
import type { MarketConversation } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { createMarketReview, uploadMarketReviewImages } from '../api/market-api'

interface MarketReviewComposerProps {
  conversation: MarketConversation
  token: string
  onSaved: () => void
  onClose?: () => void
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

export function MarketReviewComposer({ conversation, token, onSaved, onClose, t }: MarketReviewComposerProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5)
  const [comment, setComment] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    if (selected.length > 4) {
      setError(t('marketC2C.imageLimit', undefined, '最多上传 4 张图片。'))
      return
    }
    setError(null)
    setFiles(selected)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const imageUrls = files.length > 0 ? await uploadMarketReviewImages(files, token) : []
      await createMarketReview({ conversation_id: conversation.id, rating, comment, image_urls: imageUrls }, token)
      setComment('')
      setFiles([])
      onSaved()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form aria-modal={onClose ? 'true' : undefined} className={onClose ? 'market-review-composer market-modal' : 'market-review-composer'} onMouseDown={(event) => event.stopPropagation()} onSubmit={submit} role={onClose ? 'dialog' : undefined}>
      {onClose ? <IconButton className="market-modal-close" label={t('common.close', undefined, '关闭')} onClick={onClose} variant="ghost"><X size={17} /></IconButton> : null}
      <div className="market-review-composer-heading"><div><h3>{t('marketC2C.leaveReview', undefined, '留下交易评价')}</h3><p>{t('marketC2C.reviewComposerHint', undefined, '请在确认交易完成后，留下真实评价。')}</p></div></div>
      {error ? <Notice variant="error">{error}</Notice> : null}
      <div className="market-rating-picker" role="group" aria-label={t('marketC2C.rating', undefined, '买家评分')}>
        {([1, 2, 3, 4, 5] as const).map((score) => <button aria-label={t('marketC2C.starRating', { rating: score }, `${score} 星`)} aria-pressed={rating === score} className={score <= rating ? 'active' : ''} key={score} onClick={() => setRating(score)} type="button"><Star fill={score <= rating ? 'currentColor' : 'none'} size={18} /></button>)}
      </div>
      <label>{t('marketC2C.reviewMessage', undefined, '买家留言')}<textarea maxLength={1000} onChange={(event) => setComment(event.target.value)} placeholder={t('marketC2C.reviewPlaceholder', undefined, '描述本次交易的沟通和交付情况。')} required value={comment} /></label>
      <label className="market-review-upload"><span><ImagePlus size={16} /> {t('marketC2C.addReviewImages', undefined, '添加评价图片')}</span><input accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple onChange={onFilesChange} type="file" /></label>
      {files.length > 0 ? <span className="market-review-file-count">{t('marketC2C.imageSelected', { count: files.length }, `已选择 ${files.length} 张图片`)}</span> : null}
      <Button loading={saving} type="submit" variant="primary">{saving ? t('common.processing') : t('marketC2C.submitReview', undefined, '提交评价')}</Button>
    </form>
  )
}
