import { createContext, useContext } from 'react'
import type { AuthState } from '@/features/auth/model/auth-types'

export interface AppContextValue extends AuthState {
  onlineUsers: number
  onlineUserIds: string[]
  loginWithQQ: () => Promise<void>
  loginLocal: (mode: 'login' | 'register', username: string, password: string) => Promise<void>
  openLogin: () => Promise<void>
  logout: () => void
  refreshOnlineUsers: () => Promise<void>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const app = useContext(AppContext)
  if (!app) throw new Error('AppContext missing')
  return app
}
