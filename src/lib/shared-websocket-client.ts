export interface WsMessage<T = unknown> {
  type: string
  data?: T
  message?: string
}

export type WsHandler = (message: WsMessage) => void

export interface LeaderLease {
  owner: string
  expiresAt: number
}

export interface SharedSocketTiming {
  leaseTtlMs: number
  leaseRenewMs: number
  electionGraceMs: number
  claimSettleMinMs: number
  claimSettleJitterMs: number
  heartbeatMs: number
  maxReconnectAttempts: number
  maxReconnectDelayMs: number
}

export const defaultSharedSocketTiming: SharedSocketTiming = {
  leaseTtlMs: 4500,
  leaseRenewMs: 1500,
  electionGraceMs: 100,
  claimSettleMinMs: 40,
  claimSettleJitterMs: 80,
  heartbeatMs: 30000,
  maxReconnectAttempts: 8,
  maxReconnectDelayMs: 15000,
}

const SOCKET_CONNECTING = 0
const SOCKET_OPEN = 1
const MAX_PENDING_SENDS = 100

export interface SocketLike {
  readonly readyState: number
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: ((event: unknown) => void) | null
  send(data: string): void
  close(): void
}

export interface ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage(message: unknown): void
  close(): void
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface StorageChange {
  key: string | null
  newValue: string | null
}

export interface SharedWebSocketEnvironment {
  tabId: string
  storage: StorageLike
  now(): number
  random(): number
  createSocket(token: string | null): SocketLike
  createChannel(name: string): ChannelLike | null
  setTimeout(callback: () => void, delayMs: number): number
  clearTimeout(timerId: number): void
  setInterval(callback: () => void, delayMs: number): number
  clearInterval(timerId: number): void
  addStorageListener(listener: (event: StorageChange) => void): () => void
  addExitListener(listener: () => void): () => void
}

export interface SharedWebSocketOptions {
  channelName?: string
  leaseKey?: string
  busKey?: string
  tokenStorageKey?: string
  timing?: Partial<SharedSocketTiming>
}

type CoordinationMessage =
  | { type: 'hello'; source: string }
  | { type: 'leader'; source: string; lease: LeaderLease }
  | { type: 'resign'; source: string }
  | { type: 'token-refresh'; source: string }
  | { type: 'socket-event'; source: string; message: WsMessage }
  | { type: 'socket-command'; source: string; payload: string }

type CoordinationMode = 'uninitialized' | 'broadcast' | 'storage' | 'standalone'

export type ElectionDecision =
  | { action: 'claim' }
  | { action: 'follow'; waitMs: number }

export function parseLeaderLease(raw: string | null): LeaderLease | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as { owner?: unknown; expiresAt?: unknown }
    if (typeof value.owner !== 'string' || !value.owner) return null
    if (typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) || value.expiresAt <= 0) return null
    return { owner: value.owner, expiresAt: value.expiresAt }
  } catch {
    return null
  }
}

export function decideElection(
  tabId: string,
  lease: LeaderLease | null,
  now: number,
  timing: Pick<SharedSocketTiming, 'leaseTtlMs' | 'electionGraceMs'> = defaultSharedSocketTiming,
): ElectionDecision {
  if (!lease || lease.owner === tabId || lease.expiresAt <= now) return { action: 'claim' }
  return {
    action: 'follow',
    waitMs: Math.max(1, Math.min(timing.leaseTtlMs, lease.expiresAt - now + timing.electionGraceMs)),
  }
}

export function createLeaderLease(tabId: string, now: number, ttlMs: number): LeaderLease {
  return { owner: tabId, expiresAt: now + ttlMs }
}

function parseCoordinationMessage(value: unknown): CoordinationMessage | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (typeof record.source !== 'string' || !record.source || typeof record.type !== 'string') return null

  if (record.type === 'hello' || record.type === 'resign' || record.type === 'token-refresh') {
    return { type: record.type, source: record.source }
  }
  if (record.type === 'leader') {
    const leaseRecord = record.lease
    if (!leaseRecord || typeof leaseRecord !== 'object') return null
    const lease = leaseRecord as Record<string, unknown>
    if (typeof lease.owner !== 'string' || typeof lease.expiresAt !== 'number' || !Number.isFinite(lease.expiresAt)) return null
    return { type: 'leader', source: record.source, lease: { owner: lease.owner, expiresAt: lease.expiresAt } }
  }
  if (record.type === 'socket-command' && typeof record.payload === 'string') {
    return { type: 'socket-command', source: record.source, payload: record.payload }
  }
  if (record.type === 'socket-event' && record.message && typeof record.message === 'object') {
    return { type: 'socket-event', source: record.source, message: record.message as WsMessage }
  }
  return null
}

export class SharedWebSocketClient {
  private readonly environment: SharedWebSocketEnvironment
  private readonly timing: SharedSocketTiming
  private readonly channelName: string
  private readonly leaseKey: string
  private readonly busKey: string
  private readonly tokenStorageKey: string
  private readonly handlers = new Set<WsHandler>()
  private readonly pendingPayloads: string[] = []
  private channel: ChannelLike | null = null
  private socket: SocketLike | null = null
  private connectedToken: string | null = null
  private activeToken: string | null = null
  private coordinationMode: CoordinationMode = 'uninitialized'
  private participating = false
  private leader = false
  private reconnectAttempts = 0
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private renewTimer: number | null = null
  private electionTimer: number | null = null
  private messageSequence = 0

  constructor(environment: SharedWebSocketEnvironment, options: SharedWebSocketOptions = {}) {
    this.environment = environment
    this.timing = { ...defaultSharedSocketTiming, ...options.timing }
    this.channelName = options.channelName ?? 'trovebbs-shared-websocket-v1'
    this.leaseKey = options.leaseKey ?? 'trovebbs_ws_leader_v1'
    this.busKey = options.busKey ?? 'trovebbs_ws_bus_v1'
    this.tokenStorageKey = options.tokenStorageKey ?? 'token'
  }

  connect(token: string | null) {
    const tokenChanged = this.activeToken !== token
    this.activeToken = token
    this.participating = true

    if (!this.initializeCoordination()) {
      this.ensurePhysicalSocket()
      return
    }

    if (this.leader && tokenChanged) this.ensurePhysicalSocket()
    this.postCoordination({ type: 'token-refresh', source: this.environment.tabId })
    this.postCoordination({ type: 'hello', source: this.environment.tabId })
    this.scheduleElection(Math.floor(this.environment.random() * this.timing.claimSettleJitterMs))
  }

  disconnect() {
    this.participating = false
    this.activeToken = null
    this.pendingPayloads.length = 0
    this.clearElectionTimer()
    this.clearReconnectTimer()
    if (this.leader) this.relinquishLeadership()
    else this.closePhysicalSocket()
  }

  subscribe(handler: WsHandler) {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  send(message: WsMessage | string) {
    if (!this.participating) return false
    let payload: string
    try {
      payload = typeof message === 'string' ? message : JSON.stringify(message)
    } catch {
      return false
    }

    if (this.coordinationMode === 'standalone' || this.leader) {
      return this.queueOrSendPayload(payload)
    }

    const lease = this.readLease()
    if (lease && lease.owner !== this.environment.tabId && lease.expiresAt > this.environment.now()) {
      const forwarded = this.postCoordination({ type: 'socket-command', source: this.environment.tabId, payload })
      return forwarded || this.queueOrSendPayload(payload)
    }

    this.enqueuePayload(payload)
    this.scheduleElection(0)
    return true
  }

  isLeader() {
    return this.leader
  }

  private initializeCoordination() {
    if (this.coordinationMode !== 'uninitialized') return this.coordinationMode !== 'standalone'

    try {
      const probeKey = `${this.leaseKey}:probe:${this.environment.tabId}`
      this.environment.storage.setItem(probeKey, '1')
      this.environment.storage.removeItem(probeKey)
    } catch {
      this.coordinationMode = 'standalone'
      return false
    }

    try {
      this.channel = this.environment.createChannel(this.channelName)
    } catch {
      this.channel = null
    }
    this.coordinationMode = this.channel ? 'broadcast' : 'storage'
    if (this.channel) {
      this.channel.onmessage = (event) => this.handleCoordinationMessage(event.data)
    }
    this.environment.addStorageListener((event) => this.handleStorageChange(event))
    this.environment.addExitListener(() => this.handlePageExit())
    return true
  }

  private handleStorageChange(event: StorageChange) {
    if (event.key === this.tokenStorageKey) {
      this.activeToken = event.newValue
      if (this.leader) this.ensurePhysicalSocket()
      return
    }

    if (event.key === this.leaseKey) {
      if (!this.participating) return
      this.followOrElect(parseLeaderLease(event.newValue))
      return
    }

    if (this.coordinationMode === 'storage' && event.key === this.busKey && event.newValue) {
      try {
        const envelope = JSON.parse(event.newValue) as { message?: unknown }
        this.handleCoordinationMessage(envelope.message)
      } catch {
        // Ignore malformed same-origin fallback messages.
      }
    }
  }

  private handleCoordinationMessage(value: unknown) {
    const message = parseCoordinationMessage(value)
    if (!message || message.source === this.environment.tabId || !this.participating) return

    if (message.type === 'leader') {
      this.followOrElect(this.readLease() ?? message.lease)
      return
    }
    if (message.type === 'resign') {
      this.scheduleElection(Math.floor(this.environment.random() * this.timing.claimSettleJitterMs))
      return
    }
    if (message.type === 'hello') {
      if (this.leader) this.announceLeadership()
      return
    }
    if (message.type === 'token-refresh') {
      if (this.leader) this.refreshTokenFromStorage()
      return
    }
    if (message.type === 'socket-event') {
      if (!this.leader) this.emit(message.message)
      return
    }
    if (message.type === 'socket-command' && this.leader) {
      this.queueOrSendPayload(message.payload)
    }
  }

  private postCoordination(message: CoordinationMessage) {
    try {
      if (this.coordinationMode === 'broadcast' && this.channel) {
        this.channel.postMessage(message)
        return true
      }
      if (this.coordinationMode === 'storage') {
        const envelope = JSON.stringify({
          id: `${this.environment.tabId}:${this.messageSequence += 1}`,
          message,
        })
        this.environment.storage.setItem(this.busKey, envelope)
        this.environment.storage.removeItem(this.busKey)
        return true
      }
    } catch {
      this.enableStandaloneMode()
    }
    return false
  }

  private scheduleElection(delayMs: number) {
    if (!this.participating || this.coordinationMode === 'standalone') return
    this.clearElectionTimer()
    this.electionTimer = this.environment.setTimeout(() => {
      this.electionTimer = null
      this.electLeader()
    }, Math.max(0, delayMs))
  }

  private electLeader() {
    if (!this.participating || this.coordinationMode === 'standalone') return
    if (this.leader) {
      this.renewLeadership()
      this.ensurePhysicalSocket()
      return
    }

    const now = this.environment.now()
    const decision = decideElection(this.environment.tabId, this.readLease(), now, this.timing)
    if (decision.action === 'follow') {
      this.scheduleElection(decision.waitMs)
      return
    }

    const lease = createLeaderLease(this.environment.tabId, now, this.timing.leaseTtlMs)
    try {
      this.environment.storage.setItem(this.leaseKey, JSON.stringify(lease))
    } catch {
      this.enableStandaloneMode()
      return
    }
    const settleDelay = this.timing.claimSettleMinMs
      + Math.floor(this.environment.random() * this.timing.claimSettleJitterMs)
    this.scheduleElectionConfirmation(settleDelay)
  }

  private scheduleElectionConfirmation(delayMs: number) {
    this.clearElectionTimer()
    this.electionTimer = this.environment.setTimeout(() => {
      this.electionTimer = null
      const lease = this.readLease()
      const now = this.environment.now()
      if (lease?.owner === this.environment.tabId && lease.expiresAt > now) {
        this.becomeLeader()
      } else {
        this.followOrElect(lease)
      }
    }, delayMs)
  }

  private followOrElect(lease: LeaderLease | null) {
    const decision = decideElection(this.environment.tabId, lease, this.environment.now(), this.timing)
    if (decision.action === 'claim') {
      this.scheduleElection(Math.floor(this.environment.random() * this.timing.claimSettleJitterMs))
      return
    }

    if (this.leader) this.demoteFromLeader()
    this.forwardPendingPayloads()
    this.scheduleElection(decision.waitMs)
  }

  private becomeLeader() {
    if (!this.participating) return
    this.leader = true
    this.reconnectAttempts = 0
    this.clearRenewTimer()
    this.renewLeadership()
    if (!this.leader) return
    this.renewTimer = this.environment.setInterval(() => this.renewLeadership(), this.timing.leaseRenewMs)
    this.ensurePhysicalSocket()
  }

  private renewLeadership() {
    if (!this.leader || !this.participating) return
    const existing = this.readLease()
    const now = this.environment.now()
    if (existing && existing.owner !== this.environment.tabId && existing.expiresAt > now) {
      this.demoteFromLeader()
      this.followOrElect(existing)
      return
    }

    const lease = createLeaderLease(this.environment.tabId, now, this.timing.leaseTtlMs)
    try {
      this.environment.storage.setItem(this.leaseKey, JSON.stringify(lease))
      this.announceLeadership(lease)
    } catch {
      this.enableStandaloneMode()
    }
  }

  private announceLeadership(lease = this.readLease()) {
    if (!this.leader || !lease) return
    this.postCoordination({ type: 'leader', source: this.environment.tabId, lease })
  }

  private relinquishLeadership() {
    if (!this.leader) return
    const lease = this.readLease()
    if (lease?.owner === this.environment.tabId) {
      try {
        this.environment.storage.removeItem(this.leaseKey)
      } catch {
        // Best-effort handoff during logout and page teardown.
      }
    }
    this.postCoordination({ type: 'resign', source: this.environment.tabId })
    this.demoteFromLeader()
  }

  private demoteFromLeader() {
    this.leader = false
    this.clearRenewTimer()
    this.closePhysicalSocket()
  }

  private handlePageExit() {
    if (!this.participating) return
    this.clearElectionTimer()
    if (this.leader) this.relinquishLeadership()
    else this.closePhysicalSocket()
    // A page restored from the back-forward cache can rejoin after another tab has taken over.
    this.scheduleElection(this.timing.leaseTtlMs)
  }

  private refreshTokenFromStorage() {
    try {
      const storedToken = this.environment.storage.getItem(this.tokenStorageKey)
      if (storedToken !== this.activeToken) {
        this.activeToken = storedToken
        this.ensurePhysicalSocket()
      }
    } catch {
      // The current tab token remains authoritative when storage is unavailable.
    }
  }

  private readLease() {
    try {
      return parseLeaderLease(this.environment.storage.getItem(this.leaseKey))
    } catch {
      return null
    }
  }

  private ensurePhysicalSocket() {
    if (!this.participating) return
    if (this.coordinationMode !== 'standalone' && !this.leader) return
    if (
      this.socket
      && (this.socket.readyState === SOCKET_CONNECTING || this.socket.readyState === SOCKET_OPEN)
      && this.connectedToken === this.activeToken
    ) return

    this.closePhysicalSocket()
    const nextSocket = this.environment.createSocket(this.activeToken)
    this.socket = nextSocket
    this.connectedToken = this.activeToken

    nextSocket.onopen = () => {
      if (this.socket !== nextSocket) return
      this.reconnectAttempts = 0
      this.clearHeartbeatTimer()
      this.heartbeatTimer = this.environment.setInterval(() => {
        if (this.socket?.readyState === SOCKET_OPEN) {
          this.socket.send(JSON.stringify({ type: 'heartbeat' }))
        }
      }, this.timing.heartbeatMs)
      this.flushPendingPayloads()
    }

    nextSocket.onmessage = (event) => {
      if (this.socket !== nextSocket || typeof event.data !== 'string') return
      try {
        const message = JSON.parse(event.data) as WsMessage
        this.emit(message)
        if (this.leader && this.coordinationMode !== 'standalone') {
          this.postCoordination({ type: 'socket-event', source: this.environment.tabId, message })
        }
      } catch {
        // Ignore malformed frames from stale development servers.
      }
    }

    nextSocket.onclose = () => {
      if (this.socket !== nextSocket) return
      this.clearHeartbeatTimer()
      this.socket = null
      this.connectedToken = null
      this.schedulePhysicalReconnect()
    }
  }

  private closePhysicalSocket() {
    this.clearHeartbeatTimer()
    this.clearReconnectTimer()
    const current = this.socket
    this.socket = null
    this.connectedToken = null
    if (current) {
      current.onclose = null
      current.close()
    }
  }

  private schedulePhysicalReconnect() {
    if (!this.participating || (this.coordinationMode !== 'standalone' && !this.leader)) return
    if (this.reconnectTimer !== null || this.reconnectAttempts >= this.timing.maxReconnectAttempts) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, this.timing.maxReconnectDelayMs)
    this.reconnectAttempts += 1
    this.reconnectTimer = this.environment.setTimeout(() => {
      this.reconnectTimer = null
      this.ensurePhysicalSocket()
    }, delay)
  }

  private queueOrSendPayload(payload: string) {
    if (this.socket?.readyState === SOCKET_OPEN) {
      try {
        this.socket.send(payload)
        return true
      } catch {
        this.enqueuePayload(payload)
        this.closePhysicalSocket()
        this.schedulePhysicalReconnect()
        return true
      }
    }
    this.enqueuePayload(payload)
    this.ensurePhysicalSocket()
    return true
  }

  private enqueuePayload(payload: string) {
    if (this.pendingPayloads.length >= MAX_PENDING_SENDS) this.pendingPayloads.shift()
    this.pendingPayloads.push(payload)
  }

  private flushPendingPayloads() {
    while (this.socket?.readyState === SOCKET_OPEN && this.pendingPayloads.length > 0) {
      const payload = this.pendingPayloads.shift()
      if (payload === undefined) break
      try {
        this.socket.send(payload)
      } catch {
        this.pendingPayloads.unshift(payload)
        this.closePhysicalSocket()
        this.schedulePhysicalReconnect()
        break
      }
    }
  }

  private forwardPendingPayloads() {
    if (this.pendingPayloads.length === 0) return
    const payloads = this.pendingPayloads.splice(0)
    for (const payload of payloads) {
      if (!this.postCoordination({ type: 'socket-command', source: this.environment.tabId, payload })) {
        this.enqueuePayload(payload)
      }
    }
  }

  private emit(message: WsMessage) {
    for (const handler of Array.from(this.handlers)) handler(message)
  }

  private enableStandaloneMode() {
    this.coordinationMode = 'standalone'
    this.channel?.close()
    this.channel = null
    this.leader = false
    this.clearElectionTimer()
    this.clearRenewTimer()
    if (this.participating) this.ensurePhysicalSocket()
  }

  private clearHeartbeatTimer() {
    if (this.heartbeatTimer === null) return
    this.environment.clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = null
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer === null) return
    this.environment.clearTimeout(this.reconnectTimer)
    this.reconnectTimer = null
  }

  private clearRenewTimer() {
    if (this.renewTimer === null) return
    this.environment.clearInterval(this.renewTimer)
    this.renewTimer = null
  }

  private clearElectionTimer() {
    if (this.electionTimer === null) return
    this.environment.clearTimeout(this.electionTimer)
    this.electionTimer = null
  }
}
