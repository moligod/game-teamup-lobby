import assert from 'node:assert/strict'
import test from 'node:test'

import { invalidateSessionForToken } from '../storage.ts'

test('invalidates only the rejected token that is still the active session', () => {
  const values = new Map<string, string>([
    ['user', '{"id":34}'],
    ['token', 'active-token'],
  ])
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
  }
  let notifications = 0

  assert.equal(invalidateSessionForToken('older-token', storage, () => { notifications += 1 }), false)
  assert.equal(values.get('token'), 'active-token')
  assert.equal(invalidateSessionForToken('active-token', storage, () => { notifications += 1 }), true)
  assert.equal(values.has('user'), false)
  assert.equal(values.has('token'), false)
  assert.equal(notifications, 1)
  assert.equal(invalidateSessionForToken('active-token', storage, () => { notifications += 1 }), false)
  assert.equal(notifications, 1)
})
