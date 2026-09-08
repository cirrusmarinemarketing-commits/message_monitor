import { useMemo, useState } from 'react'
import type { ServiceCase, ServiceCaseStatus } from '../types'
import { formatRelativeTime } from '../lib/format'
import { getCasePriority } from '../lib/priority'
import { getIntentMeta } from '../lib/intent'
import ChannelBadge from '../components/ui/ChannelBadge'
import StatusBadge from '../components/ui/StatusBadge'
import PriorityBadge from '../components/ui/PriorityBadge'
import Badge from '../components/ui/Badge'
import FilterChips from '../components/ui/FilterChips'
import SearchInput from '../components/ui/SearchInput'
import EmptyState from '../components/ui/EmptyState'

type CasesPageProps = {
  cases: ServiceCase[]
  onSelect: (caseItem: ServiceCase) => void
}

type CaseFilter = 'all' | ServiceCaseStatus

const FILTER_OPTIONS: { value: CaseFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
]

function CasesPage({ cases, onSelect }: CasesPageProps) {
  const [filter, setFilter] = useState<CaseFilter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const map: Partial<Record<CaseFilter, number>> = { all: cases.length }
    for (const option of FILTER_OPTIONS) {
      if (option.value === 'all') continue
      map[option.value] = cases.filter((item) => item.status === option.value).length
    }
    return map
  }, [cases])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return cases.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false
      if (!term) return true

      return (
        item.id.toLowerCase().includes(term) ||
        (item.customerName ?? '').toLowerCase().includes(term) ||
        (item.equipment ?? '').toLowerCase().includes(term) ||
        (item.problem ?? '').toLowerCase().includes(term)
      )
    })
  }, [cases, filter, query])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  )

  return (
    <div className="panel panel-flush page-panel">
      <div className="panel-header inbox-header">
        <div>
          <h2>Service Cases</h2>
          <span>{sorted.length} of {cases.length} cases</span>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search case, customer, equipment…" />
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
          title="No service cases"
          description="Cases are created automatically when a message is classified as a real service request."
        />
      ) : (
        <div className="record-list">
          {sorted.map((item) => {
            const priority = getCasePriority(item.status)
            const intent = getIntentMeta(item.intent)

            return (
              <div className="record-card clickable" key={item.id} onClick={() => onSelect(item)}>
                <div className="record-card-top">
                  <div className="record-card-title">
                    <ChannelBadge channel={item.channel} compact />
                    <strong>{item.customerName ?? item.conversationId}</strong>
                  </div>
                  <div className="record-card-tags">
                    {item.status === 'OPEN' && <PriorityBadge priority={priority} />}
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                <p className="record-summary">
                  {item.summary ?? item.request ?? 'No summary captured.'}
                </p>

                <div className="record-meta">
                  {item.intent && <Badge label={intent.label} color={intent.color} />}
                  {item.equipment && <span><b>Equipment:</b> {item.equipment}</span>}
                  {item.problem && <span><b>Problem:</b> {item.problem}</span>}
                  {item.location && <span><b>Location:</b> {item.location}</span>}
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

export default CasesPage
