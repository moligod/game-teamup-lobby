export function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatNumber(value?: number | string | null) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number)) return String(value ?? '-')
  return new Intl.NumberFormat('zh-CN').format(number)
}

export function formatScore(value?: string | number | null) {
  const raw = String(value ?? '').trim()
  if (!raw) return '-'
  const withoutZeroDecimal = raw.replace(/^-?\d+\.0+$/, (match) => match.slice(0, match.indexOf('.')))
  if (/^-?\d+$/.test(withoutZeroDecimal)) {
    return new Intl.NumberFormat('zh-CN').format(Number(withoutZeroDecimal))
  }
  return raw
}

export function displayLeaderboardName(name?: string | null, type?: string | null, key?: string | null) {
  const candidates = [name, type, key].filter(Boolean).map((item) => String(item))
  return candidates.find((item) => !item.startsWith('$')) || candidates[0] || '\u672a\u547d\u540d\u6392\u884c\u699c'
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return '\u64cd\u4f5c\u5931\u8d25'
}

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}
