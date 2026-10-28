import { type FormEvent, type MouseEvent, type UIEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, LockKeyhole, MessageCircle, Reply, Search, Send, Trash2, UserPlus, X } from 'lucide-react'
import { getLobbyMessages, getTeamMessages, sendLobbyMessage, sendTeamMessage } from '../api/lobby-api'
import type { RunAction } from './TeamsPanel'
import {
  acceptFriendRequest,
  getDirectMessages,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendDirectMessage,
  sendFriendRequest,
} from '@/features/social/api/social-api'
import { formatDate, formatNumber, getErrorMessage } from '@/lib/format'
import { useI18n } from '@/lib/i18n-react'
import type { ChatMessage, DirectMessage, FriendUser, Team, TeamChatMessage, User } from '@/lib/types'
import { subscribeWebSocket } from '@/lib/ws'
import { IconButton } from '@/shared/ui/IconButton'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'

type ChatChannelPanelProps = {
  user: User | null
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  teamMessages: TeamChatMessage[]
  setTeamMessages: (messages: TeamChatMessage[]) => void
  userTeams: Team[]
  hasGameNameBinding: boolean
  loadTeamMessages: (teamId: number) => Promise<void>
  setError: (message: string | null) => void
}

export function ConnectionsPanel({
  user,
  friends,
  onlineUserIds,
  requests,
  runAction,
  setError,
  onDirectMessage,
}: {
  user: User | null
  friends: FriendUser[]
  onlineUserIds: ReadonlySet<string>
  requests: FriendUser[]
  runAction: RunAction
  setError: (message: string | null) => void
  onDirectMessage: (message: DirectMessage) => void
}) {
  const { t } = useI18n()
  const [activeView, setActiveView] = useState<'friends' | 'messages'>('friends')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<FriendUser[] | null>(null)
  const [privateFriend, setPrivateFriend] = useState<FriendUser | null>(null)
  const [activeDialog, setActiveDialog] = useState<'requests' | null>(null)
  const [unreadDirectMessageCounts, setUnreadDirectMessageCounts] = useState<Record<number, number>>({})
  const currentUserId = user?.id
  const unreadDirectMessageTotal = Object.values(unreadDirectMessageCounts).reduce((total, count) => total + count, 0)

  function clearDirectMessageUnread(friendId: number) {
    setUnreadDirectMessageCounts((current) => {
      if (!current[friendId]) return current
      const { [friendId]: _removed, ...remaining } = current
      return remaining
    })
  }

  function openPrivateChat(friend: FriendUser) {
    if (!user) {
      setError(t('team_react.loginFirst'))
      return
    }
    clearDirectMessageUnread(friend.id)
    setActiveView('messages')
    setPrivateFriend(friend)
  }

  function openFriendRequests() {
    if (!user) {
      setError(t('team_react.loginFirst'))
      return
    }
    setActiveDialog('requests')
  }

  async function searchFriends(event: FormEvent) {
    event.preventDefault()
    if (!user) {
      setError(t('team_react.loginFirst'))
      return
    }
    try {
      const payload = await searchUsers(searchKeyword)
      setSearchResults(payload.users ?? [])
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  function clearFriendSearch() {
    setSearchKeyword('')
    setSearchResults(null)
  }

  function addFriend(friend: FriendUser) {
    if (!user) return
    runAction(() => sendFriendRequest(user.id, friend.id), t('friends.request_sent'))
  }

  useEffect(() => {
    setUnreadDirectMessageCounts({})
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) return

    return subscribeWebSocket((event) => {
      if (event.type !== 'direct_message') return
      const message = (event.data as { message?: DirectMessage } | undefined)?.message
      if (!message || message.recipient_id !== currentUserId) return

      const isActiveConversation = activeView === 'messages' && privateFriend?.id === message.sender_id
      if (isActiveConversation) return

      setUnreadDirectMessageCounts((current) => ({
        ...current,
        [message.sender_id]: (current[message.sender_id] ?? 0) + 1,
      }))
      onDirectMessage(message)
    })
  }, [activeView, currentUserId, onDirectMessage, privateFriend?.id])

  return (
    <section className="panel social-hub social-hub-combined">
      <div aria-label={t('team_react.tabsFriends')} className="social-tabs social-primary-tabs" role="tablist">
        <button aria-controls="friends-panel" aria-selected={activeView === 'friends'} className={activeView === 'friends' ? 'active' : ''} id="friends-tab" onClick={() => setActiveView('friends')} role="tab" type="button">
          {t('team_react.tabsFriends')}
          <Badge>{formatNumber(friends.length)}</Badge>
        </button>
        <button aria-controls="messages-panel" aria-selected={activeView === 'messages'} className={activeView === 'messages' ? 'active' : ''} id="messages-tab" onClick={() => setActiveView('messages')} role="tab" type="button">
          {t('team_react.chatTab', undefined, '\u6d88\u606f')}
          {unreadDirectMessageTotal > 0 ? <Badge tone="info">{formatNumber(unreadDirectMessageTotal)}</Badge> : null}
        </button>
      </div>
      {activeView === 'friends' ? (
        <>
          <div className="friends-tools">
            <div className="friend-search-controls">
              <form className="friend-search-form" onSubmit={searchFriends}>
                <input aria-label={t('friends.search_users')} onChange={(event) => setSearchKeyword(event.target.value)} placeholder={t('team_react.userSearchPlaceholder')} value={searchKeyword} />
                <Button icon={<Search size={16} />} size="sm" type="submit" variant="secondary">
                  {t('common.search')}
                </Button>
              </form>
              {searchResults !== null ? <Button icon={<X size={16} />} onClick={clearFriendSearch} size="sm" variant="ghost">{t('common.cancel')}</Button> : null}
            </div>
            <span className="friend-request-trigger">
              <Button
                className="friend-request-button"
                icon={<UserPlus size={16} />}
                size="sm"
                variant={activeDialog === 'requests' ? 'primary' : 'secondary'}
                onClick={openFriendRequests}
                title={!user ? t('team_react.loginFirst') : undefined}
              >
                {t('friends.friend_requests')}
              </Button>
              {requests.length > 0 ? <Badge className="friend-request-count">{formatNumber(requests.length)}</Badge> : null}
            </span>
          </div>
          <div className="social-hub-body connections-body">
            <div aria-labelledby="friends-tab" id="friends-panel" role="tabpanel">
              <FriendsPanel
                friends={friends}
                onAddFriend={addFriend}
                onStartPrivateChat={openPrivateChat}
                runAction={runAction}
                searchResults={searchResults}
                user={user}
              />
            </div>
          </div>
        </>
      ) : (
        <div aria-labelledby="messages-tab" id="messages-panel" role="tabpanel">
          <PrivateMessagesPanel
            activeFriend={privateFriend}
            friends={friends}
            onlineUserIds={onlineUserIds}
            unreadCounts={unreadDirectMessageCounts}
            onBack={() => setPrivateFriend(null)}
            onSelectFriend={openPrivateChat}
            setError={setError}
            user={user}
          />
        </div>
      )}
      {activeDialog === 'requests' && user ? <FriendRequestsDialog onClose={() => setActiveDialog(null)} requests={requests} runAction={runAction} user={user} /> : null}
    </section>
  )
}

export function ChatChannelPanel(props: ChatChannelPanelProps) {
  return (
    <section className="panel social-hub chat-only">
      <ChatChannelContent {...props} />
    </section>
  )
}

function ChatChannelContent({
  user,
  messages,
  setMessages,
  teamMessages,
  setTeamMessages,
  userTeams,
  hasGameNameBinding,
  loadTeamMessages,
  setError,
}: ChatChannelPanelProps) {
  const { locale, t } = useI18n()
  const [activeChannel, setActiveChannel] = useState<'lobby' | 'team'>('lobby')
  const activeTeam = userTeams[0] ?? null
  const teamChannelLockedReason = !user
    ? t('team_react.loginFirst')
    : !activeTeam
      ? t('team_react.teamChannelLocked', undefined, '\u52a0\u5165\u961f\u4f0d\u540e\u53ef\u4f7f\u7528')
      : t('team_react.gameNameBindingRequired', undefined, '\u8bf7\u5148\u7ed1\u5b9a\u6e38\u620f\u540d\uff0c\u5426\u5219\u65e0\u6cd5\u52a0\u5165\u3001\u7533\u8bf7\u6216\u4f7f\u7528\u961f\u5185\u804a\u5929\u3002')
  const teamChannelDisabled = !activeTeam || !hasGameNameBinding

  useEffect(() => {
    if (teamChannelDisabled && activeChannel === 'team') setActiveChannel('lobby')
  }, [activeChannel, teamChannelDisabled])

  function selectChannel(channel: 'lobby' | 'team') {
    if (channel === 'team' && activeTeam && hasGameNameBinding) {
      setActiveChannel('team')
      loadTeamMessages(activeTeam.id).catch((error) => setError(getErrorMessage(error)))
      return
    }
    if (channel === 'team' && !hasGameNameBinding) setError(teamChannelLockedReason)
    setActiveChannel('lobby')
  }

  const activeMessages = activeChannel === 'team' ? teamMessages : messages
  const activePanelId = activeChannel === 'team' ? 'team-chat-panel' : 'lobby-chat-panel'
  const activeTabId = activeChannel === 'team' ? 'team-chat-tab' : 'lobby-chat-tab'
  const updateMessages = (nextMessages: ChatMessage[]) => {
    if (activeChannel === 'team') {
      setTeamMessages(nextMessages as TeamChatMessage[])
      return
    }
    setMessages(nextMessages)
  }

  return (
    <>
      <div aria-label={t('team_react.chatChannelTabs', undefined, '\u804a\u5929\u9891\u9053')} className="social-tabs social-primary-tabs chat-channel-tabs" role="tablist">
        <button aria-controls="lobby-chat-panel" aria-selected={activeChannel === 'lobby'} className={activeChannel === 'lobby' ? 'active' : ''} id="lobby-chat-tab" onClick={() => selectChannel('lobby')} role="tab" type="button">
          <MessageCircle size={16} />
          {locale === 'zh' ? '\u804a\u5929\u5927\u5385' : 'Chat lobby'}
        </button>
        {teamChannelDisabled ? (
          <span className="team-chat-tab-lock" onClick={() => setError(teamChannelLockedReason)} title={teamChannelLockedReason}>
            <button aria-controls="team-chat-panel" aria-selected={false} disabled id="team-chat-tab" role="tab" type="button">
              <LockKeyhole size={16} />
              {t('team_react.teamChannel', undefined, '\u961f\u5185\u804a\u5929\u9891\u9053')}
            </button>
          </span>
        ) : (
          <button aria-controls="team-chat-panel" aria-selected={activeChannel === 'team'} className={activeChannel === 'team' ? 'active' : ''} id="team-chat-tab" onClick={() => selectChannel('team')} role="tab" type="button">
            <MessageCircle size={16} />
            {t('team_react.teamChannel', undefined, '\u961f\u5185\u804a\u5929\u9891\u9053')}
          </button>
        )}
      </div>
      <div className="social-hub-body">
        <div aria-labelledby={activeTabId} id={activePanelId} role="tabpanel">
          <ChatPanel
            channel={activeChannel}
            key={activeChannel === 'team' ? `team-${activeTeam?.id ?? 'none'}` : 'lobby'}
            messages={activeMessages}
            setError={setError}
            setMessages={updateMessages}
            teamId={activeTeam?.id}
            user={user}
            hasGameNameBinding={hasGameNameBinding}
          />
        </div>
      </div>
    </>
  )
}

function PrivateMessagesPanel({
  activeFriend,
  friends,
  onlineUserIds,
  unreadCounts,
  onBack,
  onSelectFriend,
  setError,
  user,
}: {
  activeFriend: FriendUser | null
  friends: FriendUser[]
  onlineUserIds: ReadonlySet<string>
  unreadCounts: Readonly<Record<number, number>>
  onBack: () => void
  onSelectFriend: (friend: FriendUser) => void
  setError: (message: string | null) => void
  user: User | null
}) {
  const { t } = useI18n()

  if (!activeFriend || !user) {
    return (
      <div className="private-messages-panel">
        <div className="private-message-list">
          {friends.length === 0 ? <div className="empty compact-empty">{t('friends.no_friends')}</div> : null}
          {friends.map((friend) => {
            const unreadCount = unreadCounts[friend.id] ?? 0
            return (
              <button className="private-message-item" key={friend.id} onClick={() => onSelectFriend(friend)} type="button">
                <span aria-hidden="true" className="private-message-avatar">{friend.username.slice(0, 1).toUpperCase()}</span>
                <span>
                  <span className="private-message-name"><strong>{friend.username}</strong>{unreadCount > 0 ? <Badge className="private-message-unread-count" tone="info">{formatNumber(unreadCount)}</Badge> : null}</span>
                  <FriendPresence online={onlineUserIds.has(String(friend.id))} />
                </span>
                <MessageCircle aria-hidden="true" size={16} />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="private-messages-panel private-messages-chat">
      <div className="private-messages-head">
        <IconButton label={t('common.back', undefined, '\u8fd4\u56de')} onClick={onBack} variant="ghost"><ChevronLeft size={18} /></IconButton>
        <div>
          <strong>{activeFriend.username}</strong>
          <FriendPresence online={onlineUserIds.has(String(activeFriend.id))} />
        </div>
      </div>
      <DirectChatPanel friend={activeFriend} key={`private-${activeFriend.id}`} setError={setError} user={user} />
    </div>
  )
}

function FriendPresence({ online }: { online: boolean }) {
  const { t } = useI18n()

  return (
    <span className={online ? 'friend-presence online' : 'friend-presence away'}>
      <i aria-hidden="true" />
      {online ? t('common.online') : t('common.away')}
    </span>
  )
}

function DirectChatPanel({ friend, setError, user }: { friend: FriendUser; setError: (message: string | null) => void; user: User }) {
  const { t } = useI18n()
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [content, setContent] = useState('')

  useEffect(() => {
    let active = true
    void getDirectMessages(friend.id)
      .then((items) => {
        if (active) setMessages(items)
      })
      .catch((error) => {
        if (active) setError(getErrorMessage(error))
      })

    return subscribeWebSocket((event) => {
      if (event.type !== 'direct_message') return
      const message = (event.data as { message?: DirectMessage } | undefined)?.message
      if (!message || (message.sender_id !== friend.id && message.recipient_id !== friend.id)) return
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
    })
  }, [friend.id, setError])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    try {
      const message = await sendDirectMessage(friend.id, content)
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message])
      setContent('')
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-channel-layout">
        <div className="chat-conversation">
          <div className="message-list">
            {messages.map((message) => {
              const ownMessage = message.sender_id === user.id
              return <article className={ownMessage ? 'message-row own' : 'message-row'} key={message.id}>
                <div aria-hidden="true" className="chat-message-avatar">{(ownMessage ? user.username : friend.username).slice(0, 1).toUpperCase()}</div>
                <div className="chat-message-content">
                  <div className="message-meta"><span><strong>{ownMessage ? t('marketC2C.you', undefined, '\u4f60') : friend.username}</strong><time className="message-sent-at" dateTime={message.created_at}>{formatDate(message.created_at)}</time></span></div>
                  <p className="message-bubble">{message.body}</p>
                </div>
              </article>
            })}
            {messages.length === 0 ? <p className="channel-members-empty">{t('team_react.privateChatEmpty', undefined, '\u8fd8\u6ca1\u6709\u79c1\u804a\u6d88\u606f\u3002')}</p> : null}
          </div>
          <form className="chat-form" onSubmit={submit}>
            <input maxLength={1000} onChange={(event) => setContent(event.target.value)} placeholder={t('team_react.privateChatPlaceholder', undefined, '\u8f93\u5165\u79c1\u804a\u5185\u5bb9')} value={content} />
            <IconButton disabled={!content.trim()} label={t('common.send')} type="submit" variant="primary"><Send size={18} /></IconButton>
          </form>
        </div>
      </div>
    </div>
  )
}

function ChatPanel({
  user,
  messages,
  setMessages,
  setError,
  channel,
  teamId,
  hasGameNameBinding,
}: {
  user: User | null
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  setError: (message: string | null) => void
  channel: 'lobby' | 'team'
  teamId?: number
  hasGameNameBinding: boolean
}) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; x: number; y: number } | null>(null)
  const displayedMessages = channel === 'lobby' ? messages.slice(-100) : messages
  const latestMessageId = displayedMessages[displayedMessages.length - 1]?.id
  const messageListRef = useRef<HTMLDivElement>(null)
  const isViewingLatestRef = useRef(true)

  useLayoutEffect(() => {
    if (channel !== 'lobby' || !isViewingLatestRef.current) return
    const messageList = messageListRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [channel, displayedMessages.length, latestMessageId])

  useEffect(() => {
    if (!contextMenu) return
    const closeMenu = () => setContextMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('pointerdown', closeMenu)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('pointerdown', closeMenu)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [contextMenu])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!user) {
      setError(t('team_react.loginFirst'))
      return
    }
    if (channel === 'team' && !hasGameNameBinding) {
      setError(t('team_react.gameNameBindingRequired', undefined, '\u8bf7\u5148\u7ed1\u5b9a\u6e38\u620f\u540d\uff0c\u5426\u5219\u65e0\u6cd5\u52a0\u5165\u3001\u7533\u8bf7\u6216\u4f7f\u7528\u961f\u5185\u804a\u5929\u3002'))
      return
    }
    if (channel === 'team' && !teamId) return
    try {
      if (channel === 'team' && teamId) {
        await sendTeamMessage(teamId, { content, reply_to_id: replyTo?.id ?? null })
      } else {
        await sendLobbyMessage({
          username: user.username,
          status: user.role === 'admin' ? t('app.admin') : t('team.player_status'),
          content,
          reply_to_id: replyTo?.id ?? null,
        })
      }
      setContent('')
      setReplyTo(null)
      setMessages(channel === 'team' && teamId ? await getTeamMessages(teamId) : await getLobbyMessages())
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  function openMessageMenu(event: MouseEvent<HTMLParagraphElement>, message: ChatMessage) {
    event.preventDefault()
    setContextMenu({
      message,
      x: Math.min(event.clientX, window.innerWidth - 148),
      y: Math.min(event.clientY, window.innerHeight - 48),
    })
  }

  function beginReply(message: ChatMessage) {
    setReplyTo(message)
    setContextMenu(null)
  }

  function updateLatestMessagePosition(event: UIEvent<HTMLDivElement>) {
    const messageList = event.currentTarget
    isViewingLatestRef.current = messageList.scrollHeight - messageList.scrollTop - messageList.clientHeight <= 24
  }

  return (
    <div className="chat-panel">
      <div className="chat-channel-layout">
        <div className="chat-conversation">
          <div className="message-list" onScroll={channel === 'lobby' ? updateLatestMessagePosition : undefined} ref={channel === 'lobby' ? messageListRef : undefined}>
            {displayedMessages.map((message) => {
              const ownMessage = user?.username === message.username
              return (
                <article className={`${ownMessage ? 'message-row own' : 'message-row'}${channel === 'lobby' ? ' lobby-message' : ''}`} key={message.id}>
                  <div className="chat-message-avatar" aria-hidden="true">{message.username.slice(0, 1).toUpperCase()}</div>
                  <div className="chat-message-content">
                    <div className="message-meta">
                      <span><strong>{message.username}</strong>{channel === 'team' && message.status ? <em>{message.status}</em> : null}<time className="message-sent-at" dateTime={message.timestamp}>{formatDate(message.timestamp)}</time></span>
                    </div>
                    {message.reply_to_id ? (
                      <div className="message-reply-reference">
                        <Reply size={13} />
                        <span><strong>{message.reply_to_username || t('team_react.replyUnknown', undefined, '\u5df2\u5220\u9664\u6d88\u606f')}</strong><small>{message.reply_to_content || t('team_react.replyUnavailable', undefined, '\u539f\u6d88\u606f\u4e0d\u53ef\u7528')}</small></span>
                      </div>
                    ) : null}
                    <p className="message-bubble" onContextMenu={(event) => openMessageMenu(event, message)}>{message.content}</p>
                  </div>
                </article>
              )
            })}
          </div>
          {replyTo ? (
            <div className="chat-reply-composer">
              <Reply size={15} />
              <span><strong>{t('team_react.replyTo', { name: replyTo.username }, `\u56de\u590d ${replyTo.username}`)}</strong><small>{replyTo.content}</small></span>
              <IconButton label={t('common.cancel')} onClick={() => setReplyTo(null)} variant="ghost"><X size={15} /></IconButton>
            </div>
          ) : null}
          <form className="chat-form" onSubmit={submit}>
            <input disabled={channel === 'team' && !hasGameNameBinding} value={content} onChange={(event) => setContent(event.target.value)} placeholder={t('team_react.chatPlaceholder')} maxLength={200} />
            <IconButton variant="primary" label={t('common.send')} type="submit" disabled={!content.trim() || (channel === 'team' && !hasGameNameBinding)}>
              <Send size={18} />
            </IconButton>
          </form>
        </div>
      </div>
      {contextMenu ? (
        <div
          className="chat-context-menu"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => event.stopPropagation()}
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button onClick={() => beginReply(contextMenu.message)} role="menuitem" type="button"><Reply size={15} /> {t('team_react.reply', undefined, '\u56de\u590d')}</button>
        </div>
      ) : null}
    </div>
  )
}

function FriendsPanel({
  user,
  friends,
  onStartPrivateChat,
  onAddFriend,
  runAction,
  searchResults,
}: {
  user: User | null
  friends: FriendUser[]
  onStartPrivateChat: (friend: FriendUser) => void
  onAddFriend: (friend: FriendUser) => void
  runAction: RunAction
  searchResults: FriendUser[] | null
}) {
  const { t } = useI18n()

  return (
    <div className="form-stack friends-panel">
      <div className="friend-list">
        {searchResults === null ? (
          <>
            {friends.length === 0 ? <div className="empty compact-empty">{t('friends.no_friends')}</div> : null}
            {friends.map((friend) => (
              <div className="mini-item" key={friend.id}>
                <strong>{friend.username}</strong>
                <div className="row-actions friend-actions">
                  <IconButton label={t('team_react.privateChat', undefined, '\u79c1\u804a')} onClick={() => onStartPrivateChat(friend)}>
                    <MessageCircle size={16} />
                  </IconButton>
                  <IconButton variant="danger" label={t('friends.remove_friend')} onClick={() => runAction(() => removeFriend(user!.id, friend.id), t('team_react.friendDeleted'))}>
                    <Trash2 size={16} />
                  </IconButton>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {searchResults.length === 0 ? <div className="empty compact-empty">{t('friends.user_not_found')}</div> : null}
            {searchResults.map((friend) => (
              <div className="mini-item" key={friend.id}>
                <strong>{friend.username}</strong>
                <IconButton disabled={user?.id === friend.id} label={t('friends.add_friend')} onClick={() => onAddFriend(friend)}>
                  <UserPlus size={16} />
                </IconButton>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function FriendRequestsDialog({
  onClose,
  requests,
  runAction,
  user,
}: {
  onClose: () => void
  requests: FriendUser[]
  runAction: RunAction
  user: User
}) {
  const { t } = useI18n()

  return (
    <div className="friend-dialog-backdrop" onMouseDown={onClose}>
      <section aria-modal="true" className="panel friend-dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="section-head friend-dialog-head">
          <h2>{t('friends.friend_requests')}</h2>
          <IconButton label={t('common.close', undefined, '\u5173\u95ed')} onClick={onClose} variant="ghost"><X size={18} /></IconButton>
        </div>
        <div className="friend-dialog-content">
          {requests.length === 0 ? <div className="empty compact-empty">{t('friends.no_requests')}</div> : null}
          {requests.map((request) => (
            <div className="mini-item" key={request.id}>
              <strong>{request.username}</strong>
              <div className="row-actions">
                <IconButton label={t('friends.accept_request')} onClick={() => runAction(() => acceptFriendRequest(user.id, request.id), t('team_react.friendAccepted'))}>
                  <Check size={16} />
                </IconButton>
                <IconButton variant="danger" label={t('friends.reject_request')} onClick={() => runAction(() => rejectFriendRequest(user.id, request.id), t('team_react.friendRejected'))}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
