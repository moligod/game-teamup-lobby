import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { del, get, post, put } from '@/lib/api'
import { getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import { Button } from '@/shared/ui/Button'
import { Notice } from '@/shared/ui/Notice'

type Category = 'announcement' | 'update' | 'promotion' | 'pts'
type Item = { id: string; title: string; content: string; category: Category; posted_at: string | null }
const choices: { value: Category; zh: string; en: string }[] = [
  { value: 'announcement', zh: '公告', en: 'Announcement' },
  { value: 'update', zh: '更新', en: 'Update' },
  { value: 'promotion', zh: '活动', en: 'Event' },
  { value: 'pts', zh: '测试', en: 'Testing' },
]
export function AdminAnnouncementsPage({ token }: { token: string }) {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [items, setItems] = useState<Item[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<Category>('announcement')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try { setItems(await get<Item[]>('/api/admin/announcements', token)); setError('') }
    catch (err) { setError(getErrorMessage(err)) }
  }, [token])
  useEffect(() => { void load() }, [load])
  function reset() { setEditing(null); setTitle(''); setContent(''); setCategory('announcement') }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const payload = { title, content, category }
      if (editing) await put(`/api/admin/announcements/${encodeURIComponent(editing)}`, payload, token)
      else await post('/api/admin/announcements', payload, token)
      reset(); await load(); setMessage(en ? 'Announcement saved.' : '公告已保存。')
    } catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }
  async function remove(item: Item) {
    if (!window.confirm(en ? `Delete “${item.title}”?` : `确定删除“${item.title}”吗？`)) return
    setBusy(true); setError(''); setMessage('')
    try { await del(`/api/admin/announcements/${encodeURIComponent(item.id)}`, undefined, token); if (editing === item.id) reset(); await load(); setMessage(en ? 'Announcement deleted.' : '公告已删除。') }
    catch (err) { setError(getErrorMessage(err)) } finally { setBusy(false) }
  }
  return <div className="admin-page-section">
    <section className="panel admin-section">
      <h2>{en ? 'Manage announcements' : '公告管理'}</h2>
      <p>{en ? 'Publish announcements for your game. Saved posts appear on the news page immediately.' : '发布适用于任何游戏的公告，保存后立即显示在资讯页面。'}</p>
      {error && <Notice variant="error">{error}</Notice>}{message && <Notice variant="success">{message}</Notice>}
      <form className="form-stack" onSubmit={save}>
        <label>{en ? 'Title' : '标题'}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required /></label>
        <label>{en ? 'Category' : '分类'}<select value={category} onChange={e => setCategory(e.target.value as Category)}>{choices.map(x => <option value={x.value} key={x.value}>{en ? x.en : x.zh}</option>)}</select></label>
        <label>{en ? 'Content' : '内容'}<textarea value={content} onChange={e => setContent(e.target.value)} maxLength={20000} rows={8} required /></label>
        <div className="admin-console-actions"><Button type="submit" loading={busy}>{editing ? (en ? 'Save changes' : '保存修改') : (en ? 'Publish' : '发布公告')}</Button>{editing && <Button type="button" variant="secondary" onClick={reset}>{en ? 'Cancel' : '取消编辑'}</Button>}</div>
      </form>
    </section>
    <section className="panel admin-section">
      <h2>{en ? 'Published announcements' : '已发布公告'}</h2>
      <p>{en ? 'Showing up to 500 manually published announcements.' : '最多显示 500 条手动公告。'}</p>
      {items.length === 0 && <p>{en ? 'No manual announcements yet.' : '暂无手动公告。'}</p>}
      {items.map(item => <div key={item.id} className="panel" style={{ padding: 12, marginTop: 8 }}>
        <strong>{item.title}</strong><p>{choices.find(c => c.value === item.category)?.[en ? 'en' : 'zh']} · {item.posted_at ? new Date(item.posted_at).toLocaleString(locale === 'en' ? 'en-US' : 'zh-CN') : ''}</p>
        <div className="admin-console-actions"><Button type="button" variant="secondary" onClick={() => { setEditing(item.id); setTitle(item.title); setContent(item.content); setCategory(item.category); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{en ? 'Edit' : '编辑'}</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => void remove(item)}>{en ? 'Delete' : '删除'}</Button></div>
      </div>)}
    </section>
  </div>
}
