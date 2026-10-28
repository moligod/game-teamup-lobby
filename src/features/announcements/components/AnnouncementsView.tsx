import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'
import { getAnnouncements } from '../api/announcement-api'
import { formatDate, getErrorMessage, isAbortError } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { AnnouncementCategory, TrovePalAnnouncement, TrovePalAnnouncementPagination } from '@/lib/types'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'

const emptyPagination: TrovePalAnnouncementPagination = { page: 1, page_size: 10, total: 0, total_pages: 0 }

const announcementFilters = [
  { channelName: null, labelKey: 'announcements.all' },
  { channelName: 'announcements', labelKey: 'announcements.gameAnnouncements' },
  { channelName: 'game-updates', labelKey: 'announcements.gameUpdates' },
  { channelName: 'sales', labelKey: 'announcements.sales' },
  { channelName: 'pts-announcements', labelKey: 'announcements.pts' },
] as const

const categoryLabelKeys: Record<AnnouncementCategory, string> = {
  announcement: 'announcements.gameAnnouncements',
  update: 'announcements.gameUpdates',
  promotion: 'announcements.sales',
  pts: 'announcements.pts',
}

export function AnnouncementsView() {
  const { t } = useI18n()
  const [announcements, setAnnouncements] = useState<TrovePalAnnouncement[]>([])
  const [channelName, setChannelName] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<TrovePalAnnouncementPagination>(emptyPagination)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const payload = await getAnnouncements(page, channelName, signal)
      setAnnouncements(payload.items ?? [])
      setPagination(payload.pagination ?? emptyPagination)
    } catch (err) {
      if (!isAbortError(err)) setError(getErrorMessage(err))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [channelName, page])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const totalPages = Math.max(1, pagination.total_pages)

  function selectChannel(nextChannelName: string | null) {
    setChannelName(nextChannelName)
    setPage(1)
  }

  return (
    <section className="news-page">
      <nav aria-label={t('announcements.title')} className="news-filter-bar" role="tablist">
        {announcementFilters.map((filter) => (
          <button aria-selected={channelName === filter.channelName} className={channelName === filter.channelName ? 'active' : ''} key={filter.channelName ?? 'all'} onClick={() => selectChannel(filter.channelName)} role="tab" type="button">
            {t(filter.labelKey)}
          </button>
        ))}
      </nav>

      {error ? <Notice variant="warning">{error}</Notice> : null}
      {loading && announcements.length === 0 ? <div className="panel empty news-empty">{t('common.loading')}</div> : null}
      {!loading && announcements.length === 0 && !error ? <div className="panel empty news-empty">{t('announcements.empty')}</div> : null}
      <div className="news-list">
        {announcements.map((item) => <AnnouncementCard item={item} key={item.id} />)}
      </div>
      {pagination.total > 0 ? (
        <div className="news-pagination">
          <span>{`第 ${pagination.page} / ${totalPages} 页，共 ${pagination.total} 条`}</span>
          <div>
            <IconButton disabled={loading || page <= 1} label={t('leaderboard.previousPage')} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></IconButton>
            <IconButton disabled={loading || page >= totalPages} label={t('leaderboard.nextPage')} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></IconButton>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function AnnouncementCard({ item }: { item: TrovePalAnnouncement }) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)
  const shouldCollapse = item.content.length > 700
  const content = shouldCollapse && !expanded ? `${item.content.slice(0, 700).trimEnd()}...` : item.content
  const imageUrls = item.image_urls ?? []
  const categoryLabel = t(categoryLabelKeys[item.category])
  return (
    <article className={`panel news-card category-${item.category}`}>
      <div className="news-card-head">
        <div className="news-card-titleline">
          <span className="news-category">{categoryLabel}</span>
          <span className="news-channel"># {item.channel_name}</span>
        </div>
        <time dateTime={item.posted_at || undefined}>{item.posted_at ? formatDate(item.posted_at) : ''}</time>
      </div>
      <div className="news-author">@{item.author_name}</div>
      {content ? <p>{content}</p> : null}
      {imageUrls.length > 0 ? (
        <div className={imageUrls.length > 1 ? 'news-images multiple' : 'news-images'}>
          {imageUrls.map((url, index) => <img alt={`${categoryLabel} ${index + 1}`} decoding="async" key={url} loading="lazy" src={url} />)}
        </div>
      ) : null}
      <div className="news-card-actions">
        {shouldCollapse ? <button className="news-expand" onClick={() => setExpanded((value) => !value)} type="button">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{expanded ? '\u6536\u8d77\u5168\u6587' : '\u5c55\u5f00\u5168\u6587'}</button> : null}
      </div>
    </article>
  )
}
