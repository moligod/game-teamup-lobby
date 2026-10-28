import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Send, Star } from 'lucide-react'
import { getErrorMessage, isAbortError } from '@/lib/format'
import { subscribeWebSocket } from '@/lib/ws'
import type { MarketConversation, MarketConversationMessage, User } from '@/lib/types'
import { Button } from '@/shared/ui/Button'
import { Notice } from '@/shared/ui/Notice'
import { Panel } from '@/shared/ui/Panel'
import { getMarketConversationMessages, sendMarketConversationMessage } from '../api/market-api'
import { MarketReviewComposer } from './MarketReviewComposer'
import { SellerReviewPanel } from './SellerReviewPanel'

interface MarketChatWorkspaceProps {
  activeConversationId: number | null
  conversations: MarketConversation[]
  onActiveConversationChange: (conversationId: number) => void
  onRefreshConversations: () => Promise<void>
  token: string
  user: User
  t: (key: string, params?: Record<string, string | number>, fallback?: string) => string
}

function parseRealtimeMessage(data: unknown): { conversation_id: number; message: MarketConversationMessage } | null {
  if (!data || typeof data !== 'object') return null
  const payload = data as { conversation_id?: unknown; message?: unknown }
  if (typeof payload.conversation_id !== 'number' || !payload.message || typeof payload.message !== 'object') return null
  return payload as { conversation_id: number; message: MarketConversationMessage }
}

export function MarketChatWorkspace({ activeConversationId, conversations, onActiveConversationChange, onRefreshConversations, token, user, t }: MarketChatWorkspaceProps) {
  const [messages, setMessages] = useState<MarketConversationMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) ?? null,
    [activeConversationId, conversations],
  )

  const loadMessages = useCallback(async (signal?: AbortSignal) => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    setLoading(true)
    try {
      setError(null)
      setMessages(await getMarketConversationMessages(activeConversationId, token, signal))
    } catch (err) {
      if (!isAbortError(err)) setError(getErrorMessage(err))
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [activeConversationId, token])

  useEffect(() => {
    const controller = new AbortController()
    void loadMessages(controller.signal)
    setDraft('')
    setShowReviewForm(false)
    setShowReviews(false)
    return () => controller.abort()
  }, [loadMessages])

  useEffect(() => subscribeWebSocket((event) => {
    if (event.type === 'market_conversation_update') {
      void onRefreshConversations()
      return
    }
    if (event.type !== 'market_conversation_message') return
    const payload = parseRealtimeMessage(event.data)
    if (!payload) return
    if (payload.conversation_id === activeConversationId) {
      setMessages((current) => current.some((message) => message.id === payload.message.id) ? current : [...current, payload.message])
    }
    void onRefreshConversations()
  }), [activeConversationId, onRefreshConversations])

  async function submitMessage(event: FormEvent) {
    event.preventDefault()
    if (!activeConversationId || !draft.trim()) return
    setSending(true)
    try {
      const message = await sendMarketConversationMessage(activeConversationId, draft, token)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      setDraft('')
      await onRefreshConversations()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="market-chat-workspace">
      <Panel as="aside" className="market-conversation-list">
        <div className="market-chat-list-heading"><MessageCircle size={18} /><div><h2>{t('marketC2C.myChats', undefined, '我的洽谈')}</h2><p>{t('marketC2C.myChatsHint', undefined, '所有交易沟通仅对买卖双方可见。')}</p></div></div>
        <div className="market-conversation-items">
          {conversations.map((conversation) => <button aria-pressed={conversation.id === activeConversationId} className={conversation.id === activeConversationId ? 'active' : ''} key={conversation.id} onClick={() => onActiveConversationChange(conversation.id)} type="button"><strong>{conversation.counterpart_name ?? conversation.seller_name ?? conversation.buyer_name}</strong><span>{conversation.listing_title}</span><small>{conversation.last_message_body || t('marketC2C.noMessages', undefined, '尚未发送消息')}</small></button>)}
          {conversations.length === 0 ? <div className="market-chat-empty">{t('marketC2C.noChats', undefined, '还没有交易洽谈。')}</div> : null}
        </div>
      </Panel>
      <Panel as="div" className="market-chat-panel">
        {error ? <Notice variant="error">{error}</Notice> : null}
        {activeConversation ? (
          <>
            <div className="market-chat-header"><div><span>{activeConversation.listing_title}</span><h2>{activeConversation.counterpart_name ?? activeConversation.seller_name ?? activeConversation.buyer_name}</h2></div><div className="market-chat-actions"><Button onClick={() => setShowReviews((visible) => !visible)} variant="secondary">{t('marketC2C.viewReviews', undefined, '查看评价')}</Button>{activeConversation.buyer_id === user.id ? <Button icon={<Star size={16} />} onClick={() => setShowReviewForm((visible) => !visible)} variant="secondary">{t('marketC2C.leaveReview', undefined, '留下评价')}</Button> : null}</div></div>
            <div className="market-message-list" aria-live="polite">
              {loading ? <span className="muted">{t('common.loading', undefined, '加载中...')}</span> : null}
              {messages.map((message) => <article className={message.sender_id === user.id ? 'market-message own' : 'market-message'} key={message.id}><strong>{message.sender_id === user.id ? t('marketC2C.you', undefined, '你') : message.sender_name}</strong><p>{message.body}</p></article>)}
              {!loading && messages.length === 0 ? <div className="market-chat-empty">{t('marketC2C.startConversation', undefined, '发送一条消息，开始本次交易洽谈。')}</div> : null}
            </div>
            <form className="market-chat-composer" onSubmit={submitMessage}><textarea maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder={t('marketC2C.messagePlaceholder', undefined, '输入交易相关消息...')} required value={draft} /><Button disabled={!draft.trim()} icon={<Send size={16} />} loading={sending} type="submit" variant="primary">{t('marketC2C.send', undefined, '发送')}</Button></form>
          </>
        ) : <div className="market-chat-empty"><MessageCircle size={22} /><span>{t('marketC2C.selectChat', undefined, '从左侧选择一个洽谈，或在商品列表中联系卖家。')}</span></div>}
      </Panel>
      {activeConversation && showReviews ? <div className="market-modal-backdrop" onMouseDown={() => setShowReviews(false)}><SellerReviewPanel sellerId={activeConversation.seller_id} sellerName={activeConversation.seller_name ?? activeConversation.counterpart_name ?? ''} onClose={() => setShowReviews(false)} t={t} /></div> : null}
      {activeConversation && showReviewForm ? <div className="market-modal-backdrop" onMouseDown={() => setShowReviewForm(false)}><MarketReviewComposer conversation={activeConversation} onClose={() => setShowReviewForm(false)} onSaved={() => { setShowReviewForm(false); setShowReviews(true) }} t={t} token={token} /></div> : null}
    </section>
  )
}
