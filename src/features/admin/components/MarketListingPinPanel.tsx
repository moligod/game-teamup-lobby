import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Pin, PinOff, RefreshCw, Search, Trash2 } from 'lucide-react'
import { deleteAdminMarketListing, getAdminMarketListings, setAdminMarketListingPinned } from '../api/admin-api'
import { formatDate, formatNumber, getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { AdminMarketListingPage, MarketListing } from '@/lib/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import '../admin-market.css'

const emptyPage: AdminMarketListingPage = { items: [], total: 0, page: 1, page_size: 20 }

export function MarketListingPinPanel({ token, onError }: { token: string; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<AdminMarketListingPage>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadListings = useCallback(async () => {
    setLoading(true)
    try {
      setResult(await getAdminMarketListings(query, page, token))
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [onError, page, query, token])

  useEffect(() => {
    void loadListings()
  }, [loadListings])

  async function togglePin(listing: MarketListing) {
    setUpdatingId(listing.id)
    try {
      const updated = await setAdminMarketListingPinned(listing.id, !listing.is_pinned, token)
      setResult((current) => ({
        ...current,
        items: current.items.map((item) => item.id === updated.id ? { ...item, is_pinned: updated.is_pinned } : item),
      }))
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setUpdatingId(null)
    }
  }

  async function deleteListing(listing: MarketListing) {
    const confirmed = window.confirm(t(
      'market.adminDeleteConfirm',
      { title: listing.title },
      `确定删除商品「${listing.title}」吗？此操作会同时删除该商品的私聊与评价，无法恢复。`,
    ))
    if (!confirmed) return

    setDeletingId(listing.id)
    try {
      await deleteAdminMarketListing(listing.id, token)
      setResult((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== listing.id),
        total: Math.max(0, current.total - 1),
      }))
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setDeletingId(null)
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size))

  return (
    <section className="panel admin-section admin-market-panel">
      <div className="section-head">
        <div>
          <h2><Pin size={18} /> {t('market.adminPinTitle', undefined, '\u7f6e\u9876\u7528\u6237\u5546\u54c1')}</h2>
          <p className="muted">{t('market.adminPinHint', undefined, '\u4ec5\u5bf9\u7528\u6237\u53d1\u5e03\u4e14\u5728\u552e\u7684\u5546\u54c1\u751f\u6548\uff0c\u88ab\u7f6e\u9876\u7684\u5546\u54c1\u4f1a\u6392\u5728\u5bf9\u5e94\u5206\u7c7b\u5217\u8868\u6700\u524d\u3002')}</p>
        </div>
        <div className="row-actions">
          <Badge tone="info">{formatNumber(result.total)}</Badge>
          <Button icon={<RefreshCw size={16} />} loading={loading} onClick={() => void loadListings()} size="sm" variant="secondary">{t('common.refresh')}</Button>
        </div>
      </div>

      <form className="market-pin-search" onSubmit={submitSearch}>
        <label>
          <Search size={16} />
          <input maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder={t('market.adminPinSearch', undefined, '\u641c\u7d22\u5356\u5bb6\u540d\u6216\u5546\u54c1\u6807\u9898')} value={search} />
        </label>
        <Button icon={<Search size={16} />} type="submit" variant="primary">{t('common.search')}</Button>
      </form>

      <div className="admin-market-list market-pin-list">
        {result.items.map((listing) => (
          <article className={listing.is_pinned ? 'admin-market-row market-pin-row pinned' : 'admin-market-row market-pin-row'} key={listing.id}>
            <div>
              <strong>{listing.title}</strong>
              <span>{listing.seller_name || `#${listing.seller_id}`}{' \u00b7 '}{t(`market.categories.${listing.category}`)}{' \u00b7 '}{Number(listing.price).toFixed(2)} / {listing.price_unit}</span>
              <small>{formatDate(listing.updated_at || listing.created_at)}</small>
            </div>
            <div className="market-pin-status">
              <Badge tone={listing.is_active === false ? 'neutral' : 'success'}>{listing.is_active === false ? t('market.adminUnlisted', undefined, '\u5df2\u4e0b\u67b6') : t('market.adminListed', undefined, '\u5728\u552e')}</Badge>
              {listing.is_pinned ? <Badge icon={<Pin size={13} />} tone="info">{t('market.pinned', undefined, '\u7f6e\u9876')}</Badge> : null}
            </div>
            <div className="admin-market-row-actions">
              <IconButton disabled={updatingId === listing.id || deletingId === listing.id} label={listing.is_pinned ? t('market.adminUnpin', undefined, '\u53d6\u6d88\u7f6e\u9876') : t('market.adminPin', undefined, '\u7f6e\u9876\u5546\u54c1')} onClick={() => void togglePin(listing)} variant={listing.is_pinned ? 'primary' : 'default'}>
                {listing.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </IconButton>
              <IconButton disabled={updatingId === listing.id || deletingId === listing.id} label={t('market.adminDeleteListing', undefined, '\u5220\u9664\u5546\u54c1')} onClick={() => void deleteListing(listing)} variant="danger">
                <Trash2 size={16} />
              </IconButton>
            </div>
          </article>
        ))}
        {!loading && result.items.length === 0 ? <div className="empty">{t('market.adminPinEmpty', undefined, '\u6682\u65e0\u5339\u914d\u7684\u7528\u6237\u5546\u54c1\u3002')}</div> : null}
      </div>

      <div className="market-pin-pagination">
        <span>{t('market.adminPage', { page: result.page, total: totalPages }, `\u7b2c ${result.page} / ${totalPages} \u9875`)}</span>
        <div>
          <IconButton disabled={loading || result.page <= 1} label={t('leaderboard.previousPage')} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></IconButton>
          <IconButton disabled={loading || result.page >= totalPages} label={t('leaderboard.nextPage')} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></IconButton>
        </div>
      </div>
    </section>
  )
}
