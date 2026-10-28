import { del, get, post, put } from '@/lib/api'
import type { DirectMessage, FriendUser } from '@/lib/types'

export function getFriends(userId: number) {
  return get<FriendUser[]>(`/api/friends/${userId}`)
}

export function getFriendRequests(userId: number) {
  return get<FriendUser[]>(`/api/friend-requests/${userId}`)
}

export function searchUsers(keyword: string) {
  return get<{ users: FriendUser[] }>(`/api/users/search?keyword=${encodeURIComponent(keyword)}`)
}

export function sendFriendRequest(userId: number, friendId: number) {
  return post('/api/friends', { userId, friendId })
}

export function acceptFriendRequest(userId: number, friendId: number) {
  return put('/api/friends/accept', { userId, friendId })
}

export function rejectFriendRequest(userId: number, friendId: number) {
  return del('/api/friends/reject', { userId, friendId })
}

export function removeFriend(userId: number, friendId: number) {
  return del('/api/friends', { userId, friendId })
}

export function getDirectMessages(friendId: number) {
  return get<DirectMessage[]>(`/api/direct-messages/${friendId}`)
}

export function sendDirectMessage(friendId: number, body: string) {
  return post<DirectMessage>('/api/direct-messages', { friendId, body })
}
