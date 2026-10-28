import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, FileWarning, ImagePlus, LogIn, Search, Send, X } from 'lucide-react'
import { formatDate, getErrorMessage } from '@/lib/format'
import type { DishonestyReport, DishonestyReportPage } from '@/lib/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { IconButton } from '@/shared/ui/IconButton'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'
import { createDishonestyReport, getDishonestyReports, uploadDishonestyEvidence } from '../api/market-api'
import '../market.css'

const emptyPage: DishonestyReportPage = { items: [], total: 0, page: 1, page_size: 10 }

interface DishonestyReportsViewProps {
  loginWithQQ: () => Promise<void>
  token: string | null
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

function ReportIdentifiers({ report, t }: { report: DishonestyReport; t: DishonestyReportsViewProps['t'] }) {
  return <div className="dishonesty-report-identifiers">
    {report.dishonest_qq ? <Badge tone="warning">{t('market.dishonestyQq', undefined, '失信 QQ')} {report.dishonest_qq}</Badge> : null}
    {report.dishonest_player_name ? <Badge tone="neutral">{t('market.dishonestyPlayerName', undefined, '失信玩家名')} {report.dishonest_player_name}</Badge> : null}
  </div>
}

function EvidenceImages({ report, t }: { report: DishonestyReport; t: DishonestyReportsViewProps['t'] }) {
  return <div className="dishonesty-evidence-images" aria-label={t('market.dishonestyEvidence', undefined, '证据图')}>
    {report.evidence_urls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank"><img alt={t('market.dishonestyEvidence', undefined, '证据图')} loading="lazy" src={url} /></a>)}
  </div>
}

function DishonestySubmissionForm({ onClose, onSubmitted, t, token }: Pick<DishonestyReportsViewProps, 't' | 'token'> & { onClose: () => void; onSubmitted: () => void }) {
  const [dishonestQq, setDishonestQq] = useState('')
  const [dishonestPlayerName, setDishonestPlayerName] = useState('')
  const [reason, setReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  function onFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    if (selected.length > 4) {
      setError(t('market.dishonestyEvidenceLimit', undefined, '最多上传 4 张证据图。'))
      return
    }
    setError(null)
    setFiles(selected)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    if (!dishonestQq.trim() && !dishonestPlayerName.trim()) {
      setError(t('market.dishonestyIdentifierRequired', undefined, '请至少填写失信 QQ 或失信玩家名。'))
      return
    }
    if (files.length === 0) {
      setError(t('market.dishonestyEvidenceRequired', undefined, '请至少上传一张证据图。'))
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const evidenceUrls = await uploadDishonestyEvidence(files, token)
      await createDishonestyReport({
        dishonest_qq: dishonestQq.trim() || undefined,
        dishonest_player_name: dishonestPlayerName.trim() || undefined,
        reason: reason.trim(),
        evidence_urls: evidenceUrls,
      }, token)
      setDishonestQq('')
      setDishonestPlayerName('')
      setReason('')
      setFiles([])
      setMessage(t('market.dishonestySubmitted', undefined, '已提交，等待后台审核。'))
      onSubmitted()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return <form aria-modal="true" className="dishonesty-submit-form dishonesty-modal" onSubmit={submit} role="dialog">
    <IconButton className="dishonesty-modal-close" label={t('common.close', undefined, '关闭')} onClick={onClose} variant="ghost"><X size={18} /></IconButton>
    <div className="dishonesty-form-heading"><FileWarning size={20} /><div><h2>{t('market.dishonestySubmitTitle', undefined, '提交失信记录')}</h2><p>{t('market.dishonestySubmitHint', undefined, '提交后由后台审核，通过后才会公开显示。')}</p></div></div>
    {message ? <Notice variant="success">{message}</Notice> : null}
    {error ? <Notice variant="error">{error}</Notice> : null}
    <div className="dishonesty-form-grid">
      <label>{t('market.dishonestyQq', undefined, '失信 QQ')}<input maxLength={32} onChange={(event) => setDishonestQq(event.target.value)} placeholder={t('market.dishonestyQqPlaceholder', undefined, '可选，至少填写一项')} value={dishonestQq} /></label>
      <label>{t('market.dishonestyPlayerName', undefined, '失信玩家名')}<input maxLength={80} onChange={(event) => setDishonestPlayerName(event.target.value)} placeholder={t('market.dishonestyPlayerNamePlaceholder', undefined, '可选，至少填写一项')} value={dishonestPlayerName} /></label>
      <label className="dishonesty-form-wide">{t('market.dishonestyReason', undefined, '原因')}<textarea maxLength={1000} onChange={(event) => setReason(event.target.value)} placeholder={t('market.dishonestyReasonPlaceholder', undefined, '请如实说明交易经过和失信行为。')} required rows={3} value={reason} /></label>
      <label className="dishonesty-upload"><span><ImagePlus size={16} /> {t('market.dishonestyEvidence', undefined, '证据图')}</span><span className="dishonesty-upload-action">{t('market.dishonestySelectEvidence', undefined, '选择证据图')}</span><input accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple onChange={onFilesChange} required type="file" /></label>
    </div>
    <div className="dishonesty-form-actions"><span>{files.length > 0 ? t('market.dishonestyEvidenceSelected', { count: files.length }, `已选择 ${files.length} 张证据图`) : t('market.dishonestyEvidenceRequired', undefined, '请至少上传一张证据图。')}</span><Button icon={<Send size={16} />} loading={saving} type="submit" variant="primary">{t('market.dishonestySubmit', undefined, '提交审核')}</Button></div>
  </form>
}

export function DishonestyReportsView({ loginWithQQ, token, t }: DishonestyReportsViewProps) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<DishonestyReportPage>(emptyPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [loginBusy, setLoginBusy] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      setResult(await getDishonestyReports(query, page))
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void loadReports()
  }, [loadReports])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    setQuery(search.trim())
  }

  async function openSubmissionDialog() {
    if (token) {
      setShowSubmissionDialog(true)
      return
    }

    setLoginBusy(true)
    setLoginError(null)
    try {
      await loginWithQQ()
    } catch (err) {
      setLoginError(getErrorMessage(err))
      setLoginBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.page_size))

  return <div className="dishonesty-layout">
    <Panel className="dishonesty-guide"><FileWarning size={20} /><div className="dishonesty-guide-copy"><h2>{t('market.dishonestyList', undefined, '失信名单')}</h2><p>{t('market.dishonestyGuide', undefined, '仅展示后台审核通过的记录，请依据证据谨慎核实。')}</p></div><Button className="dishonesty-submit-trigger" icon={token ? <FileWarning size={16} /> : <LogIn size={16} />} loading={loginBusy} onClick={() => void openSubmissionDialog()} variant="primary">{token ? t('market.dishonestySubmitTitle', undefined, '提交失信记录') : t('market.dishonestyLoginTitle', undefined, '登录后提交失信记录')}</Button></Panel>
    {loginError ? <Notice variant="error">{loginError}</Notice> : null}
    {showSubmissionDialog ? <div className="market-modal-backdrop"><DishonestySubmissionForm onClose={() => setShowSubmissionDialog(false)} onSubmitted={() => void loadReports()} t={t} token={token} /></div> : null}
    <section className="dishonesty-results">
      <div className="dishonesty-results-heading"><div><h2>{t('market.dishonestyPublicRecords', undefined, '已审核失信记录')}</h2><p>{t('market.dishonestyPublicRecordsHint', undefined, '可按失信 QQ 或失信玩家名搜索。')}</p></div><Badge tone="info">{result.total}</Badge></div>
      <form className="dishonesty-search" onSubmit={submitSearch}><label><Search size={16} /><input maxLength={120} onChange={(event) => setSearch(event.target.value)} placeholder={t('market.dishonestySearchPlaceholder', undefined, '搜索失信 QQ 或失信玩家名')} value={search} /></label><Button icon={<Search size={16} />} type="submit" variant="primary">{t('common.search')}</Button></form>
      {error ? <Notice variant="error">{error}</Notice> : null}
      <div className="dishonesty-report-list">
        {result.items.map((report) => <article className="dishonesty-report-card" key={report.id}><div className="dishonesty-report-main"><ReportIdentifiers report={report} t={t} /><p>{report.reason}</p><small>{t('market.dishonestyApprovedAt', undefined, '审核通过')} {formatDate(report.reviewed_at || report.created_at)}</small></div><EvidenceImages report={report} t={t} /></article>)}
        {!loading && result.items.length === 0 ? <Panel className="market-empty"><h2>{t('market.dishonestyEmpty', undefined, '没有匹配的失信记录')}</h2><p>{t('market.dishonestyEmptyHint', undefined, '请更换关键词后再试。')}</p></Panel> : null}
      </div>
      <div className="dishonesty-pagination"><span>{t('market.dishonestyPage', { page: result.page, total: totalPages }, `第 ${result.page} / ${totalPages} 页`)}</span><div><IconButton disabled={loading || result.page <= 1} label={t('leaderboard.previousPage')} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={16} /></IconButton><IconButton disabled={loading || result.page >= totalPages} label={t('leaderboard.nextPage')} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={16} /></IconButton></div></div>
    </section>
  </div>
}
