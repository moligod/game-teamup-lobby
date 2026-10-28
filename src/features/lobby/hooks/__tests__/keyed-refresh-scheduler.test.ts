import assert from 'node:assert/strict'
import test from 'node:test'
import {
  appendUniqueRealtimeMessage,
  createKeyedRefreshScheduler,
} from '../keyed-refresh-scheduler.ts'

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

test('coalesces repeated work for the same key and keeps the latest task', async () => {
  const calls: string[] = []
  const scheduler = createKeyedRefreshScheduler<string>({ delayMs: 10 })

  scheduler.schedule('teams', () => { calls.push('first') })
  scheduler.schedule('teams', () => { calls.push('second') })
  scheduler.schedule('teams', () => { calls.push('latest') })

  await wait(30)
  assert.deepEqual(calls, ['latest'])
  scheduler.dispose()
})

test('keeps one request in flight and performs one trailing refresh', async () => {
  let releaseFirst: (() => void) | undefined
  const firstRequest = new Promise<void>((resolve) => { releaseFirst = resolve })
  let calls = 0
  let active = 0
  let maxActive = 0
  const scheduler = createKeyedRefreshScheduler<string>({ delayMs: 10 })
  const task = async () => {
    calls += 1
    active += 1
    maxActive = Math.max(maxActive, active)
    if (calls === 1) await firstRequest
    active -= 1
  }

  scheduler.schedule('user-teams', task)
  await wait(20)
  scheduler.schedule('user-teams', task)
  scheduler.schedule('user-teams', task)
  await wait(20)

  assert.equal(calls, 1)
  releaseFirst?.()
  await wait(20)
  assert.equal(calls, 2)
  assert.equal(maxActive, 1)
  scheduler.dispose()
})

test('different resource keys can refresh independently', async () => {
  const calls: string[] = []
  const scheduler = createKeyedRefreshScheduler<string>({ delayMs: 5 })

  scheduler.schedule('teams', () => { calls.push('teams') })
  scheduler.schedule('friends', () => { calls.push('friends') })

  await wait(20)
  assert.deepEqual(calls.toSorted(), ['friends', 'teams'])
  scheduler.dispose()
})

test('appends realtime messages once and enforces the snapshot limit', () => {
  const messages = [{ id: 1 }, { id: 2 }]

  assert.equal(appendUniqueRealtimeMessage(messages, { id: 2 }, 2), messages)
  assert.deepEqual(appendUniqueRealtimeMessage(messages, { id: 3 }, 2), [{ id: 2 }, { id: 3 }])
})
