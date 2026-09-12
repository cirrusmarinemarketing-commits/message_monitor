import { getStatusMeta } from '../../lib/status'
import Badge from './Badge'

type StatusBadgeProps = {
  status: string | null | undefined
  /** Dot-only, no pill/label - for dense rows (e.g. system health lists). */
  compact?: boolean
}

function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  const meta = getStatusMeta(status)

  if (compact) {
    return <span className="badge-dot" style={{ background: meta.color }} title={meta.label} />
  }

  return <Badge label={meta.label} color={meta.color} />
}

export default StatusBadge
