import { del, get, post } from '@/lib/api'
import type { GameBinding, PlayerBinding } from '@/lib/types'

export interface PlayerBindingMutation {
  message: string
  playerName?: string
}

export function bindPlayer(userId: number, playerName: string) {
  return post<PlayerBindingMutation>('/api/user/bind-player', { userId, playerName })
}

export function unbindPlayer(userId: number) {
  return del<PlayerBindingMutation>(`/api/user/bind-player/${userId}`)
}

export function getPlayerBinding(userId: number) {
  return get<PlayerBinding>(`/api/user/bind-player/${userId}`)
}

export function getGameBindings(userId: number) {
  return get<GameBinding[]>(`/api/user/${userId}/game-bindings`)
}

export function getPlayerCombat(playerName: string) {
  return get<Record<string, unknown>>(`/api/player/combat/${encodeURIComponent(playerName)}`)
}

export function getProfessionCombatStats() {
  return get<Array<Record<string, unknown>>>('/api/professions/combat-stats')
}
