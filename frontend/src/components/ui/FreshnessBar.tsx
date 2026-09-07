import { useEffect, useState } from 'react'
import { formatRelativeTime } from '../../lib/format'

type FreshnessBarProps = {
  online: boolean
  stale: boolean
  lastUpdatedAt: number | null
  onRefresh: () => void
}

function FreshnessBar({ online, stale, lastUpdatedAt, onRefresh }: FreshnessBarProps) {
  const [, forceTick] = useState(0)

  // Re-render every 10s so the relative "updated Xs ago" label stays fresh.
  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  const label = !online
    ? 'Backend unreachable'
    : stale
      ? 'Data may be stale'
      : 'Live'

  const tone = !online ? 'error' : stale ? 'warning' : 'success'

  return (
    <div className={`freshness-bar freshness-${tone}`}>
      <span className="freshness-dot" />
      <span>{label}</span>
      {lastUpdatedAt && (
        <span className="freshness-updated">
          · updated {formatRelativeTime(new Date(lastUpdatedAt).toISOString())}
        </span>
      )}
      <button type="button" className="freshness-refresh" onClick={onRefresh}>
        Refresh
      </button>
    </div>
  )
}

export default FreshnessBar
