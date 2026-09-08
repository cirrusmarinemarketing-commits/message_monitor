import { useMemo, useState } from 'react'
import type { ActivityEvent, Channel } from '../types'
import { formatDateTime, formatRelativeTime } from '../lib/format'
import ChannelBadge from '../components/ui/ChannelBadge'
import StatusBadge from '../components/ui/StatusBadge'
import FilterChips from '../components/ui/FilterChips'
import EmptyState from '../components/ui/EmptyState'

type ActivityPageProps = {
  activity: ActivityEvent[]
}

type ChannelFilter = 'all' | Channel | 'error'

const FILTER_OPTIONS: { value: ChannelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'error', label: 'Errors only' },
]

const EVENT_LABELS: Record<string, string> = {
  whatsapp_received: 'WhatsApp received',
  gmail_received: 'Gmail received',
  conversation_updated: 'Conversation updated',
  ai_analysis_completed: 'AI analysis completed',
  business_action_generated: 'Business action generated',
  case_created: 'Case created',
  handoff_created: 'Human handoff created',
  response_generated: 'Response generated',
  processing_error: 'Processing error',
}

function ActivityPage({ activity }: ActivityPageProps) {
  const [filter, setFilter] = useState<ChannelFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return activity
    if (filter === 'error') return activity.filter((event) => event.status === 'error')
    return activity.filter((event) => event.channel === filter)
  }, [activity, filter])

  return (
    <div className="panel panel-flush page-panel">
      <div className="panel-header inbox-header">
        <div>
          <h2>Activity Monitor</h2>
          <span>Live system event stream · {filtered.length} events</span>
        </div>
      </div>

      <div className="inbox-filters">
        <FilterChips options={FILTER_OPTIONS} active={filter} onChange={setFilter} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No events yet" description="Events appear here as messages move through the pipeline." />
      ) : (
        <div className="activity-feed">
          {filtered.map((event) => (
            <div className={`activity-row${event.status === 'error' ? ' activity-row-error' : ''}`} key={event.id}>
              <span className="activity-row-time" title={formatDateTime(event.timestamp)}>
                {formatRelativeTime(event.timestamp)}
              </span>
              <ChannelBadge channel={event.channel} compact />
              <div className="activity-row-content">
                <span className="activity-row-type">{EVENT_LABELS[event.type] ?? event.type}</span>
                <span className="activity-row-message">{event.message}</span>
                {event.customerName && (
                  <span className="activity-row-meta">{event.customerName} · {event.conversationId}</span>
                )}
              </div>
              <StatusBadge status={event.status === 'error' ? 'error' : 'healthy'} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ActivityPage
