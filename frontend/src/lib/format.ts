function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null

  const asNumber = Number(value)
  const looksLikeUnixSeconds = Number.isFinite(asNumber) && value.length <= 10

  const date = looksLikeUnixSeconds ? new Date(asNumber * 1000) : new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  if (!date) return '—'

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  if (!date) return '—'

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatRelativeTime(value: string | null | undefined): string {
  const date = parseTimestamp(value)
  if (!date) return '—'

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 5) return 'just now'
  if (diffSec < 60) return `${diffSec}s ago`

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`

  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`

  return formatDateTime(value)
}
