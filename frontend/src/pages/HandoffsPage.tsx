import { useMemo, useState } from 'react'
import type { HumanHandoff, HumanHandoffStatus } from '../types'
import { formatRelativeTime } from '../lib/format'
import { getHandoffPriority } from '../lib/priority'
import { getIntentMeta } from '../lib/intent'
import ChannelBadge from '../components/ui/ChannelBadge'
import StatusBadge from '../components/ui/StatusBadge'
import PriorityBadge from '../components/ui/PriorityBadge'
import Badge from '../components/ui/Badge'
import FilterChips from '../components/ui/FilterChips'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'

type HandoffsPageProps = {
  handoffs: HumanHandoff[]
  onSelect: (handoff: HumanHandoff) => void
}

type HandoffFilter = 'all' | HumanHandoffStatus

const FILTER_OPTIONS: { value: HandoffFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

function HandoffsPage({ handoffs, onSelect }: HandoffsPageProps) {
  const [filter, setFilter] = useState<HandoffFilter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const map: Partial<Record<HandoffFilter, number>> = { all: handoffs.length }
    for (const option of FILTER_OPTIONS) {
      if (option.value === 'all') continue
      map[option.value] = handoffs.filter((item) => item.status === option.value).length
    }
    return map
  }, [handoffs])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return handoffs.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false
      if (!term) return true

      return (
        item.id.toLowerCase().includes(term) ||
        (item.customerName ?? '').toLowerCase().includes(term) ||
        (item.reason ?? '').toLowerCase().includes(term)
      )
    })
  }, [handoffs, filter, query])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const byPriority = getHandoffPriority(b.status).localeCompare(getHandoffPriority(a.status))
      if (a.status === 'OPEN' && b.status !== 'OPEN') return -1
      if (b.status === 'OPEN' && a.status !== 'OPEN') return 1
      if (byPriority !== 0) return 0
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [filtered])

  return (
    <div className="panel panel-flush page-panel">
      <div className="panel-header inbox-header">
        <div>
          <h2>Human Handoffs</h2>
          <span>{sorted.length} of {handoffs.length} handoffs</span>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search customer or reason…" />
      </div>

      <div className="inbox-filters">
        <FilterChips
          options={FILTER_OPTIONS.map((option) => ({ ...option, count: counts[option.value] }))}
          active={filter}
          onChange={setFilter}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          title="No handoffs"
          description="A handoff is raised whenever a customer explicitly asks to speak with a person."
        />
      ) : (
        <div className="record-list">
          {sorted.map((item) => {
            const priority = getHandoffPriority(item.status)
            const intent = getIntentMeta(item.intent)

            return (
              <div className="record-card clickable" key={item.id} onClick={() => onSelect(item)}>
                <div className="record-card-top">
                  <div className="record-card-title">
                    <ChannelBadge channel={item.channel} compact />
                    <strong>{item.customerName ?? item.conversationId}</strong>
                  </div>
                  <div className="record-card-tags">
                    <PriorityBadge priority={priority} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                <p className="record-summary">{item.reason ?? item.request ?? 'No reason captured.'}</p>

                <div className="record-meta">
                  <Badge label={intent.label} color={intent.color} />
                  {item.problem && <span><b>Problem:</b> {item.problem}</span>}
                  <span><b>Owner:</b> {item.assignedTo ?? 'Unassigned'}</span>
                </div>

                <div className="record-footer">
                  <span>{item.id}</span>
                  <span>{formatRelativeTime(item.createdAt)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default HandoffsPage
