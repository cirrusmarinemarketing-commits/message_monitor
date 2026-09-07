import type { Priority } from '../../lib/priority'
import { PRIORITY_META } from '../../lib/priority'
import Badge from './Badge'

type PriorityBadgeProps = {
  priority: Priority
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority]
  return <Badge label={meta.label} color={meta.color} />
}

export default PriorityBadge
