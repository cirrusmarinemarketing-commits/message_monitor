import { getStatusMeta } from '../../lib/status'
import Badge from './Badge'

type StatusBadgeProps = {
  status: string | null | undefined
}

function StatusBadge({ status }: StatusBadgeProps) {
  const meta = getStatusMeta(status)
  return <Badge label={meta.label} color={meta.color} />
}

export default StatusBadge
