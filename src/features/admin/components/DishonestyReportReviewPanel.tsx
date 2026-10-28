import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronLeft, ChevronRight, FileWarning, RefreshCw, Search, X, ZoomIn } from 'lucide-react'
import { getAdminDishonestyReports, reviewAdminDishonestyReport } from '../api/admin-api'
import { formatDate, formatNumber, getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { DishonestyReport, DishonestyReportPage, DishonestyReportStatus } from '@/lib/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import '../admin-market.css'

type ReportFilter = DishonestyReportStatus | 'all'

const emptyPage: DishonestyReportPage = { items: [], total: 0, page: 1, page_size: 20 }

function toneForStatus(status: DishonestyReportStatus) {
  return status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'warning'
}

export function DishonestyReportReviewPanel({ token, onError }: { token: string; onError: (message: string) => void }) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<ReportFilter>('pending')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<DishonestyReportPage>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      setResult(await getAdminDishonestyReports(query, filter, page, token))
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [filter, onError, page, query, token])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  async function review(report: DishonestyReport, status: 'approved' | 'rejected') {
    setReviewingId(report.id)
    try {
      await reviewAdminDishonestyReport(report.id, status, token)
      await loadReports()
    } catch (err) {
      onError(getErrorMessage(err))
    } finally {
      setReviewingId(null)
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  function chooseFilter(nextFilter: ReportFilter) {
    setFilter(nextFilter)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size))

  return <section className="panel admin-section admin-market-panel admin-dishonesty-panel">
    <div className="section-head">
      <div><h2><FileWarning size={18} /> {t('market.adminDishonestyTitle', undefined, '失信名单审核')}</h2><p className="muted">{t('market.adminDishonestyHint', undefined, '仅审核证据完整、信息明确的提交；通过后会公开显示在失信名单。')}</p></div>
      <div className="row-actions"><Badge tone="info">{formatNumber(result.total)}</Badge><Button icon={<RefreshCw size={16} />} loading={loading} onClick={() => void loadReports()} size="sm" variant="secondary">{t('common.refresh')}</Button></div>
    </div>
    <div className="admin-dishonesty-controls">
      <form className="market-pin-search" onSubmit={submitSearch}><label><Search size={16} /><input maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder={t('market.adminDishonestySearch', undefined, '搜索 QQ、玩家名或原因')} value={search} /></label><Button icon={<Search size={16} />} type="submit" variant="primary">{t('common.search')}</Button></form>
      <select aria-label={t('market.adminDishonestyStatus', undefined, '审核状态')} onChange={(event) => chooseFilter(event.target.value as ReportFilter)} value={filter}><option value="pending">{t('market.adminDishonestyPending', undefined, '待审核')}</option><option value="approved">{t('market.adminDishonestyApproved', undefined, '已通过')}</option><option value="rejected">{t('market.adminDishonestyRejected', undefined, '已拒绝')}</option><option value="all">{t('common.all')}</option></select>
    </div>
    <div className="admin-dishonesty-list">
      {result.items.map((report) => {
        const status = report.status ?? 'pending'
        return <article className="admin-dishonesty-row" key={report.id}>
          <div className="admin-dishonesty-content"><div className="admin-dishonesty-identifiers">{report.dishonest_qq ? <Badge tone="warning">QQ {report.dishonest_qq}</Badge> : null}{report.dishonest_player_name ? <Badge tone="neutral">{t('market.dishonestyPlayerName', undefined, '失信玩家名')} {report.dishonest_player_name}</Badge> : null}<Badge tone={toneForStatus(status)}>{status === 'pending' ? t('market.adminDishonestyPending', undefined, '待审核') : status === 'approved' ? t('market.adminDishonestyApproved', undefined, '已通过') : t('market.adminDishonestyRejected', undefined, '已拒绝')}</Badge></div><p>{report.reason}</p><small>{t('market.adminDishonestyReporter', undefined, '提交人')} {report.reporter_name || `#${report.reporter_id}`} · {formatDate(report.created_at)}</small></div>
          <div className="admin-dishonesty-evidence">{report.evidence_urls.map((url, index) => <button aria-label={t('market.dishonestyViewEvidence', undefined, '查看证据图')} key={url} onClick={() => setPreviewUrl(url)} type="button"><img alt={`${t('market.dishonestyEvidence', undefined, '证据图')} ${index + 1}`} src={url} /><ZoomIn size={13} /></button>)}</div>
          <div className="admin-dishonesty-actions">{status === 'pending' ? <><IconButton disabled={reviewingId === report.id} label={t('market.adminDishonestyApprove', undefined, '审核通过')} onClick={() => void review(report, 'approved')} variant="primary"><Check size={16} /></IconButton><IconButton disabled={reviewingId === report.id} label={t('market.adminDishonestyReject', undefined, '审核拒绝')} onClick={() => void review(report, 'rejected')} variant="danger"><X size={16} /></IconButton></> : <small>{report.reviewer_name ? `${t('market.adminDishonestyReviewer', undefined, '审核人')} ${report.reviewer_name}` : ''}</small>}</div>
        </article>
      })}
      {!loading && result.items.length === 0 ? <div className="empty">{t('market.adminDishonestyEmpty', undefined, '暂无匹配的失信记录。')}</div> : null}
    </div>
    <div className="market-pin-pagination"><span>{t('market.adminPage', { page: result.page, total: totalPages }, `第 ${result.page} / ${totalPages} 页`)}</span><div><IconButton disabled={loading || result.page <= 1} label={t('leaderboard.previousPage')} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></IconButton><IconButton disabled={loading || result.page >= totalPages} label={t('leaderboard.nextPage')} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></IconButton></div></div>
    {previewUrl ? <div className="admin-image-preview-backdrop" onMouseDown={() => setPreviewUrl(null)}><div aria-label={t('market.dishonestyViewEvidence', undefined, '查看证据图')} aria-modal="true" className="admin-image-preview" onMouseDown={(event) => event.stopPropagation()} role="dialog"><IconButton label={t('common.close', undefined, '关闭')} onClick={() => setPreviewUrl(null)} variant="ghost"><X size={18} /></IconButton><img alt={t('market.dishonestyEvidence', undefined, '证据图')} src={previewUrl} /></div></div> : null}
  </section>
}
