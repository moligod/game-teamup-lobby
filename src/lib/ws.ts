import { WS_BASE_URL } from '@/config/constants'
import {
  SharedWebSocketClient,
  type ChannelLike,
  type SharedWebSocketEnvironment,
  type SocketLike,
  type WsHandler,
  type WsMessage,
} from './shared-websocket-client'

export type { WsMessage } from './shared-websocket-client'

const clientIdKey = 'trovebbs_ws_client_id'
let volatileClientId: string | null = null
let sharedClient: SharedWebSocketClient | null = null

function createId(prefix: string) {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomPart}`
}

function getClientId() {
  try {
    let clientId = window.localStorage.getItem(clientIdKey)
    if (!clientId) {
      clientId = createId('web')
      window.localStorage.setItem(clientIdKey, clientId)
    }
    return clientId
  } catch {
    volatileClientId ??= createId('web')
    return volatileClientId
  }
}

function createChannel(name: string): ChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') return null
  const channel = new BroadcastChannel(name)
  const adapter: ChannelLike = {
    onmessage: null,
    postMessage(message) {
      channel.postMessage(message)
    },
    close() {
      channel.close()
    },
  }
  channel.onmessage = (event) => adapter.onmessage?.({ data: event.data })
  return adapter
}

function createSocket(token: string | null): SocketLike {
  const url = new URL(WS_BASE_URL)
  url.searchParams.set('clientId', getClientId())
  const protocols = token ? ['trovebbs', `bearer.${token}`] : ['trovebbs']
  return new WebSocket(url.toString(), protocols) as unknown as SocketLike
}

function createBrowserEnvironment(): SharedWebSocketEnvironment {
  return {
    tabId: createId('tab'),
    storage: window.localStorage,
    now: () => Date.now(),
    random: () => Math.random(),
    createSocket,
    createChannel,
    setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimeout: (timerId) => window.clearTimeout(timerId),
    setInterval: (callback, delayMs) => window.setInterval(callback, delayMs),
    clearInterval: (timerId) => window.clearInterval(timerId),
    addStorageListener(listener) {
      const handler = (event: StorageEvent) => listener({ key: event.key, newValue: event.newValue })
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
    addExitListener(listener) {
      window.addEventListener('pagehide', listener)
      window.addEventListener('beforeunload', listener)
      return () => {
        window.removeEventListener('pagehide', listener)
        window.removeEventListener('beforeunload', listener)
      }
    },
  }
}

function getSharedClient() {
  sharedClient ??= new SharedWebSocketClient(createBrowserEnvironment())
  return sharedClient
}

export function connectWebSocket(token: string | null) {
  getSharedClient().connect(token)
}

export function disconnectWebSocket() {
  sharedClient?.disconnect()
}

export function subscribeWebSocket(handler: WsHandler) {
  return getSharedClient().subscribe(handler)
}

export function sendWebSocket(message: WsMessage | string) {
  return getSharedClient().send(message)
}
