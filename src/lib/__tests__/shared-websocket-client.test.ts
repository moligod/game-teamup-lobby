import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SharedWebSocketClient,
  createLeaderLease,
  decideElection,
  defaultSharedSocketTiming,
  parseLeaderLease,
  type ChannelLike,
  type SharedWebSocketEnvironment,
  type SocketLike,
  type StorageChange,
} from '../shared-websocket-client.ts'

interface ClockTask {
  id: number
  owner: string
  at: number
  intervalMs: number | null
  callback: () => void
}

class FakeClock {
  now = 1000
  private nextId = 1
  private readonly tasks = new Map<number, ClockTask>()

  schedule(owner: string, callback: () => void, delayMs: number, intervalMs: number | null) {
    const id = this.nextId
    this.nextId += 1
    this.tasks.set(id, { id, owner, at: this.now + Math.max(0, delayMs), intervalMs, callback })
    return id
  }

  cancel(id: number) {
    this.tasks.delete(id)
  }

  cancelOwner(owner: string) {
    for (const [id, task] of this.tasks) {
      if (task.owner === owner) this.tasks.delete(id)
    }
  }

  advance(durationMs: number) {
    const target = this.now + durationMs
    let executions = 0
    while (true) {
      const next = Array.from(this.tasks.values())
        .filter((task) => task.at <= target)
        .sort((left, right) => left.at - right.at || left.id - right.id)[0]
      if (!next) break
      if (executions > 10000) throw new Error('Fake clock task loop exceeded its bound')
      executions += 1
      this.now = next.at
      if (next.intervalMs === null) this.tasks.delete(next.id)
      else {
        next.at += next.intervalMs
        this.tasks.set(next.id, next)
      }
      next.callback()
    }
    this.now = target
  }
}

class FakeSocket implements SocketLike {
  readyState = 0
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: unknown) => void) | null = null
  readonly sent: string[] = []
  readonly owner: string
  readonly token: string | null
  openedAt: number | null = null
  private readonly clock: FakeClock

  constructor(owner: string, token: string | null, clock: FakeClock) {
    this.owner = owner
    this.token = token
    this.clock = clock
  }

  open() {
    if (this.readyState !== 0) return
    this.readyState = 1
    this.openedAt = this.clock.now
    this.onopen?.({})
  }

  send(data: string) {
    if (this.readyState !== 1) throw new Error('Socket is not open')
    this.sent.push(data)
  }

  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  close() {
    if (this.readyState === 3) return
    this.readyState = 3
    this.onclose?.({})
  }

  crash() {
    this.readyState = 3
    this.onopen = null
    this.onmessage = null
    this.onclose = null
  }
}

class FakeChannel implements ChannelLike {
  onmessage: ((event: { data: unknown }) => void) | null = null
  closed = false
  readonly owner: string
  readonly name: string
  private readonly platform: FakePlatform

  constructor(owner: string, name: string, platform: FakePlatform) {
    this.owner = owner
    this.name = name
    this.platform = platform
  }

  postMessage(message: unknown) {
    this.platform.broadcast(this, message)
  }

  close() {
    this.closed = true
  }
}

class FakePlatform {
  readonly clock = new FakeClock()
  readonly sockets: FakeSocket[] = []
  private readonly values = new Map<string, string>()
  private readonly storageListeners = new Map<string, Set<(event: StorageChange) => void>>()
  private readonly exitListeners = new Map<string, Set<() => void>>()
  private readonly channels = new Set<FakeChannel>()
  private readonly broadcastEnabled: boolean

  constructor(broadcastEnabled: boolean) {
    this.broadcastEnabled = broadcastEnabled
  }

  environment(tabId: string, randomValue: number): SharedWebSocketEnvironment {
    return {
      tabId,
      storage: {
        getItem: (key) => this.values.get(key) ?? null,
        setItem: (key, value) => this.setStorage(tabId, key, value),
        removeItem: (key) => this.removeStorage(tabId, key),
      },
      now: () => this.clock.now,
      random: () => randomValue,
      createSocket: (token) => {
        const socket = new FakeSocket(tabId, token, this.clock)
        this.sockets.push(socket)
        this.clock.schedule(tabId, () => socket.open(), 0, null)
        return socket
      },
      createChannel: (name) => {
        if (!this.broadcastEnabled) return null
        const channel = new FakeChannel(tabId, name, this)
        this.channels.add(channel)
        return channel
      },
      setTimeout: (callback, delayMs) => this.clock.schedule(tabId, callback, delayMs, null),
      clearTimeout: (timerId) => this.clock.cancel(timerId),
      setInterval: (callback, delayMs) => this.clock.schedule(tabId, callback, delayMs, delayMs),
      clearInterval: (timerId) => this.clock.cancel(timerId),
      addStorageListener: (listener) => this.addListener(this.storageListeners, tabId, listener),
      addExitListener: (listener) => this.addListener(this.exitListeners, tabId, listener),
    }
  }

  broadcast(source: FakeChannel, message: unknown) {
    for (const channel of this.channels) {
      if (channel !== source && !channel.closed && channel.name === source.name) {
        channel.onmessage?.({ data: message })
      }
    }
  }

  activeSockets() {
    return this.sockets.filter((socket) => socket.readyState === 1)
  }

  crash(tabId: string) {
    this.clock.cancelOwner(tabId)
    this.storageListeners.delete(tabId)
    this.exitListeners.delete(tabId)
    for (const channel of this.channels) {
      if (channel.owner === tabId) channel.close()
    }
    for (const socket of this.sockets) {
      if (socket.owner === tabId) socket.crash()
    }
  }

  private setStorage(source: string, key: string, value: string) {
    if (this.values.get(key) === value) return
    this.values.set(key, value)
    this.notifyStorage(source, { key, newValue: value })
  }

  private removeStorage(source: string, key: string) {
    if (!this.values.has(key)) return
    this.values.delete(key)
    this.notifyStorage(source, { key, newValue: null })
  }

  private notifyStorage(source: string, event: StorageChange) {
    for (const [tabId, listeners] of this.storageListeners) {
      if (tabId === source) continue
      for (const listener of Array.from(listeners)) listener(event)
    }
  }

  private addListener<T>(map: Map<string, Set<T>>, tabId: string, listener: T) {
    const listeners = map.get(tabId) ?? new Set<T>()
    listeners.add(listener)
    map.set(tabId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) map.delete(tabId)
    }
  }
}

function createPair(broadcastEnabled: boolean) {
  const platform = new FakePlatform(broadcastEnabled)
  const first = new SharedWebSocketClient(platform.environment('tab-a', 0.1))
  const second = new SharedWebSocketClient(platform.environment('tab-b', 0.8))
  first.connect('shared-token')
  second.connect('shared-token')
  platform.clock.advance(500)
  return { platform, first, second }
}

test('leader lease decisions are bounded and reject malformed records', () => {
  assert.equal(parseLeaderLease('{bad-json'), null)
  assert.equal(parseLeaderLease(JSON.stringify({ owner: '', expiresAt: 10 })), null)

  const lease = createLeaderLease('tab-a', 1000, defaultSharedSocketTiming.leaseTtlMs)
  assert.deepEqual(decideElection('tab-a', lease, 1100), { action: 'claim' })
  const followerDecision = decideElection('tab-b', lease, 1100)
  assert.equal(followerDecision.action, 'follow')
  if (followerDecision.action === 'follow') {
    assert.ok(followerDecision.waitMs <= defaultSharedSocketTiming.leaseTtlMs)
  }
  assert.deepEqual(decideElection('tab-b', lease, lease.expiresAt), { action: 'claim' })
})

test('BroadcastChannel tabs share one socket and forward events and commands', () => {
  const { platform, first, second } = createPair(true)
  assert.equal(platform.activeSockets().length, 1)
  assert.notEqual(first.isLeader(), second.isLeader())

  const firstEvents: unknown[] = []
  const secondEvents: unknown[] = []
  first.subscribe((message) => firstEvents.push(message))
  second.subscribe((message) => secondEvents.push(message))

  const socket = platform.activeSockets()[0]
  const event = { type: 'team_created', data: { id: 7 } }
  socket.receive(event)
  assert.deepEqual(firstEvents, [event])
  assert.deepEqual(secondEvents, [event])

  const follower = first.isLeader() ? second : first
  assert.equal(follower.send({ type: 'chat_message', message: 'hello' }), true)
  assert.equal(socket.sent.at(-1), JSON.stringify({ type: 'chat_message', message: 'hello' }))
})

test('localStorage events carry socket traffic when BroadcastChannel is unavailable', () => {
  const { platform, first, second } = createPair(false)
  assert.equal(platform.activeSockets().length, 1)

  const followerEvents: unknown[] = []
  const follower = first.isLeader() ? second : first
  follower.subscribe((message) => followerEvents.push(message))
  const socket = platform.activeSockets()[0]
  const event = { type: 'market_conversation_update', data: { conversation_id: 9 } }
  socket.receive(event)
  assert.deepEqual(followerEvents, [event])

  follower.send({ type: 'ping' })
  assert.equal(socket.sent.at(-1), JSON.stringify({ type: 'ping' }))
})

test('a follower takes over within the bounded lease window after a leader crash', () => {
  const { platform, first, second } = createPair(true)
  const originalSocket = platform.activeSockets()[0]
  const originalLeader = originalSocket.owner
  const follower = first.isLeader() ? second : first
  const crashedAt = platform.clock.now
  platform.crash(originalLeader)

  const takeoverBound = defaultSharedSocketTiming.leaseTtlMs
    + defaultSharedSocketTiming.electionGraceMs
    + defaultSharedSocketTiming.claimSettleMinMs
    + defaultSharedSocketTiming.claimSettleJitterMs
    + 100
  platform.clock.advance(takeoverBound)

  const replacement = platform.activeSockets()[0]
  assert.ok(replacement)
  assert.notEqual(replacement.owner, originalLeader)
  assert.equal(follower.isLeader(), true)
  assert.ok((replacement.openedAt ?? Infinity) - crashedAt <= takeoverBound)
  assert.equal(platform.activeSockets().length, 1)
})
