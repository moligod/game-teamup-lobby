import { API_BASE_URL } from '@/config/constants'
import { getStoredLocale } from './i18n'
import { invalidateSessionForToken } from './storage'

type ApiOptions = RequestInit & {
  token?: string | null
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

function unwrapResponse(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload &&
    (payload as { success?: unknown }).success === true
  ) {
    return (payload as { data: unknown }).data
  }
  return payload
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token: requestedToken, ...requestOptions } = options
  const headers = new Headers(requestOptions.headers)
  if (!(requestOptions.body instanceof FormData) && requestOptions.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  let resolvedToken = requestedToken
  if (resolvedToken === undefined) {
    try {
      resolvedToken = window.localStorage.getItem('token')
    } catch {
      resolvedToken = null
    }
  }
  if (resolvedToken) {
    headers.set('Authorization', `Bearer ${resolvedToken}`)
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getStoredLocale() === 'en' ? 'en-US,en;q=0.9' : 'zh-CN,zh;q=0.9')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers,
  })

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    if (response.status === 401) invalidateSessionForToken(resolvedToken)
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `HTTP ${response.status}`
    throw new ApiError(message, response.status)
  }

  return unwrapResponse(payload) as T
}

export function get<T>(path: string, token?: string | null, options: RequestInit = {}) {
  return apiRequest<T>(path, { ...options, token })
}

export function post<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  })
}

export function put<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    token,
  })
}

export function patch<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  })
}

export function del<T>(path: string, body?: unknown, token?: string | null) {
  return apiRequest<T>(path, {
    method: 'DELETE',
    body: body === undefined ? undefined : JSON.stringify(body),
    token,
  })
}
