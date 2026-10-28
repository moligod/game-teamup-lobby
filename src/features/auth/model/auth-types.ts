import type { User } from '@/lib/types'

export interface AuthState {
  user: User | null
  token: string | null
}
