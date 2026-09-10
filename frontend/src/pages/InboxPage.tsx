import { useEffect, useMemo, useState } from 'react'
import type { ConversationSummary, HumanHandoff, ServiceCase } from '../types'
import { isOpenCaseStatus, isOpenHandoffStatus } from '../lib/status'
import { comparePriority, getConversationPriority } from '../lib/priority'
import { formatRelativeTime } from '../lib/format'
import { getIntentMeta, getActionLabel } from '../lib/intent'
import ChannelBadge from '../components/ui/ChannelBadge'
import StatusBadge from '../components/ui/StatusBadge'
import PriorityBadge from '../components/ui/PriorityBadge'
import Badge from '../components/ui/Badge'
import SearchInput from '../components/ui/SearchInput'
import FilterChips from '../components/ui/FilterChips'
import EmptyState from '../components/ui/EmptyState'

export type InboxFilter =
  | 'all'
  | 'whatsapp'
  | 'email'
  | 'needs_attention'
  | 'waiting_for_cirrus'
  | 'waiting_for_customer'
  | 'open_case'
  | 'handoff'
  | 'resolved'

type SortMode = 'priority' | 'newest'

type InboxPageProps = {
  conversations: ConversationSummary[]
  cases: ServiceCase[]
  handoffs: HumanHandoff[]
  initialFilter: InboxFilter
  onSelect: (conversation: ConversationSummary) => void
}

const FILTER_OPTIONS: { value: InboxFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'waiting_for_cirrus', label: 'Waiting for Cirrus' },
  { value: 'waiting_for_customer', label: 'Waiting for customer' },
  { value: 'open_case', label: 'Open case' },
  { value: 'handoff', label: 'Human handoff' },
  { value: 'resolved', label: 'Resolved' },
]

function lastActivityAt(conversation: ConversationSummary): number {
  return conversation.lastMessage?.timestamp
    ? new Date(conversation.lastMessage.timestamp).getTime() || 0
    : 0
}

function InboxPage({ conversations, cases, handoffs, initialFilter, onSelect }: InboxPageProps) {
  const [filter, setFilter] = useState<InboxFilter>(initialFilter)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('priority')

  // Adjust state during render instead of an effect that calls setState
  // synchronously (React's recommended pattern for mirroring a prop into
  // local state that the user can still change afterward).
  const [prevInitialFilter, setPrevInitialFilter] = useState(initialFilter)
  if (initialFilter !== prevInitialFilter) {
    setPrevInitialFilter(initialFilter)
    setFilter(initialFilter)
  }

  // A ticking "now" in state (not a bare Date.now() read during render)
  // so the "new message" indicator actually re-evaluates as time passes,
  // instead of only when some other prop happens to change.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const openCaseKeys = useMemo(
    () =>
      new Set(
        cases
          .filter((item) => isOpenCaseStatus(item.status))
          .map((item) => `${item.channel}:${item.conversationId}`),
      ),
    [cases],
  )

  const openHandoffKeys = useMemo(
    () =>
      new Set(
        handoffs
          .filter((item) => isOpenHandoffStatus(item.status))
          .map((item) => `${item.channel}:${item.conversationId}`),
      ),
    [handoffs],
  )

  const enriched = useMemo(
    () =>
      conversations.map((conversation) => {
        const key = `${conversation.channel}:${conversation.conversationId}`
        const hasOpenCase = openCaseKeys.has(key)
        const hasOpenHandoff = openHandoffKeys.has(key)

        return {
          conversation,
          hasOpenCase,
          hasOpenHandoff,
          priority: getConversationPriority(conversation, hasOpenHandoff, hasOpenCase),
          needsAttention:
            hasOpenHandoff ||
            conversation.conversationStatus === 'needs_clarification' ||
            (hasOpenCase && conversation.conversationStatus === 'waiting_for_cirrus'),
          isNew:
            !hasOpenCase &&
            !hasOpenHandoff &&
            lastActivityAt(conversation) > now - 5 * 60 * 1000,
        }
      }),
    [conversations, openCaseKeys, openHandoffKeys, now],
  )

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()

    return enriched.filter(({ conversation, hasOpenCase, hasOpenHandoff, needsAttention }) => {
      if (filter === 'whatsapp' && conversation.channel !== 'whatsapp') return false
      if (filter === 'email' && conversation.channel !== 'email') return false
      if (filter === 'needs_attention' && !needsAttention) return false
      if (filter === 'waiting_for_cirrus' && conversation.conversationStatus !== 'waiting_for_cirrus') return false
      if (filter === 'waiting_for_customer' && conversation.conversationStatus !== 'waiting_for_customer') return false
      if (filter === 'open_case' && !hasOpenCase) return false
      if (filter === 'handoff' && !hasOpenHandoff) return false
      if (filter === 'resolved' && conversation.conversationStatus !== null && !['normal_chat'].includes(conversation.conversationStatus ?? '') && hasOpenCase) return false

      if (!term) return true

      return (
        conversation.conversationId.toLowerCase().includes(term) ||
        (conversation.customerName ?? '').toLowerCase().includes(term) ||
        (conversation.lastMessage?.text ?? '').toLowerCase().includes(term) ||
        (conversation.lastMessage?.subject ?? '').toLowerCase().includes(term)
      )
    })
  }, [enriched, filter, query])

  const sorted = useMemo(() => {
    const list = [...filtered]

    if (sort === 'priority') {
      list.sort((a, b) => {
        const byPriority = comparePriority(a.priority, b.priority)
        if (byPriority !== 0) return byPriority
        return lastActivityAt(b.conversation) - lastActivityAt(a.conversation)
      })
    } else {
      list.sort((a, b) => lastActivityAt(b.conversation) - lastActivityAt(a.conversation))
    }

    return list
  }, [filtered, sort])

  const counts = useMemo(() => {
    const map: Partial<Record<InboxFilter, number>> = {}
    for (const option of FILTER_OPTIONS) {
      map[option.value] =
        option.value === 'all'
          ? enriched.length
          : enriched.filter((item) => {
            if (option.value === 'whatsapp') return item.conversation.channel === 'whatsapp'
            if (option.value === 'email') return item.conversation.channel === 'email'
            if (option.value === 'needs_attention') return item.needsAttention
            if (option.value === 'waiting_for_cirrus') return item.conversation.conversationStatus === 'waiting_for_cirrus'
            if (option.value === 'waiting_for_customer') return item.conversation.conversationStatus === 'waiting_for_customer'
            if (option.value === 'open_case') return item.hasOpenCase
            if (option.value === 'handoff') return item.hasOpenHandoff
            return false
          }).length
    }
    return map
  }, [enriched])

  return (
    <div className="panel panel-flush page-panel">
      <div className="panel-header inbox-header">
        <div>
          <h2>Inbox</h2>
          <span>{sorted.length} of {conversations.length} conversations</span>
        </div>

        <div className="inbox-controls">
          <SearchInput value={query} onChange={setQuery} placeholder="Search customer, ID, or message…" />
          <select className="chart-select" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
          </select>
        </div>
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
          title="No conversations match"
          description="Try a different filter or clear your search."
        />
      ) : (
        <div className="inbox-list">
          {sorted.map(({ conversation, hasOpenCase, hasOpenHandoff, priority, needsAttention, isNew }) => {
            const intentMeta = getIntentMeta(conversation.intent)
            const key = `${conversation.channel}:${conversation.conversationId}`

            return (
              <div
                key={key}
                className={`inbox-row${needsAttention ? ' inbox-row-attention' : ''}`}
                onClick={() => onSelect(conversation)}
              >
                <div className="inbox-row-identity">
                  {isNew && <span className="inbox-dot-new" title="New" />}
                  <ChannelBadge channel={conversation.channel} compact />
                  <div className="inbox-row-name">
                    <strong>
                      {conversation.customerName ?? conversation.conversationId}
                      {conversation.groupId && <span className="group-badge">Group</span>}
                    </strong>
                    <span>{conversation.lastMessage?.subject ?? conversation.conversationId}</span>
                  </div>
                </div>

                <div className="inbox-row-message">
                  {conversation.lastMessage?.text ?? 'No messages yet'}
                </div>

                <div className="inbox-row-tags">
                  <Badge label={intentMeta.label} color={intentMeta.color} />
                  {conversation.action && (
                    <Badge label={getActionLabel(conversation.action)} color="#2563eb" />
                  )}
                  <StatusBadge status={conversation.conversationStatus} />
                  {hasOpenCase && <StatusBadge status="OPEN" />}
                  {hasOpenHandoff && <PriorityBadge priority="urgent" />}
                </div>

                <div className="inbox-row-meta">
                  <PriorityBadge priority={priority} />
                  <span className="inbox-row-time">
                    {formatRelativeTime(conversation.lastMessage?.timestamp)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default InboxPage
