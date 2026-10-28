export type RefreshTask = () => void | Promise<void>

export interface KeyedRefreshScheduler<Key> {
  schedule: (key: Key, task: RefreshTask) => void
  dispose: () => void
}

interface RefreshState {
  timer: ReturnType<typeof setTimeout> | null
  running: boolean
  pending: boolean
  task: RefreshTask
}

interface KeyedRefreshSchedulerOptions {
  delayMs?: number
  onError?: (error: unknown) => void
}

export function createKeyedRefreshScheduler<Key>({
  delayMs = 200,
  onError,
}: KeyedRefreshSchedulerOptions = {}): KeyedRefreshScheduler<Key> {
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError('delayMs must be a non-negative finite number')
  }

  const states = new Map<Key, RefreshState>()
  let disposed = false

  const run = (key: Key, state: RefreshState) => {
    if (disposed || state.running || !state.pending || states.get(key) !== state) return

    state.pending = false
    state.running = true
    const task = state.task

    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        try {
          onError?.(error)
        } catch {
          // Refresh failures are non-fatal and must not break trailing work.
        }
      })
      .finally(() => {
        state.running = false
        if (disposed || states.get(key) !== state) return

        if (state.pending) {
          // If the debounce timer elapsed during the request, run exactly one
          // trailing refresh now. Otherwise the active timer will run it later.
          if (state.timer === null) run(key, state)
          return
        }

        if (state.timer === null) states.delete(key)
      })
  }

  const schedule = (key: Key, task: RefreshTask) => {
    if (disposed) return

    let state = states.get(key)
    if (!state) {
      state = { timer: null, running: false, pending: false, task }
      states.set(key, state)
    }

    state.task = task
    state.pending = true
    if (state.timer !== null) clearTimeout(state.timer)

    state.timer = setTimeout(() => {
      if (disposed || states.get(key) !== state) return
      state.timer = null
      run(key, state)
    }, delayMs)
  }

  const dispose = () => {
    if (disposed) return
    disposed = true
    states.forEach((state) => {
      if (state.timer !== null) clearTimeout(state.timer)
      state.timer = null
      state.pending = false
    })
    states.clear()
  }

  return { schedule, dispose }
}

export function appendUniqueRealtimeMessage<Message extends { id: number }>(
  messages: Message[],
  message: Message,
  limit: number,
) {
  if (messages.some((current) => current.id === message.id)) return messages
  if (messages.length < limit) return [...messages, message]
  return [...messages.slice(-(limit - 1)), message]
}
