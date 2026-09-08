import { useMemo } from 'react'
import type {
  ActivityEvent,
  ConversationSummary,
  HumanHandoff,
  Overview,
  ServiceCase,
  SystemHealth,
} from '../types'
import type { InboxFilter } from './InboxPage'
import { isOpenCaseStatus, isOpenHandoffStatus } from '../lib/status'
import { formatRelativeTime } from '../lib/format'
import { getChannelMeta } from '../lib/channel'
import KpiCard from '../components/ui/KpiCard'
import StatusBadge from '../components/ui/StatusBadge'
import ChannelBadge from '../components/ui/ChannelBadge'
import EmptyState from '../components/ui/EmptyState'

type OverviewPageProps = {
  overview: Overview | null
  conversations: ConversationSummary[]
  cases: ServiceCase[]
  handoffs: HumanHandoff[]
  activity: ActivityEvent[]
  health: SystemHealth | null
  onSelectConversation: (conversation: ConversationSummary) => void
  onSelectCase: (item: ServiceCase) => void
  onNavigateInbox: (filter: InboxFilter) => void
}

const ACTIVE_STATUSES = new Set([
  'waiting_for_cirrus',
  'waiting_for_customer',
  'pending_action',
  'needs_clarification',
])

const HEALTH_COMPONENT_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp ingestion',
  gmail: 'Gmail ingestion',
  ai: 'AI processing',
  pipeline: 'Pipeline processing',
}

function OverviewPage({
  overview,
  conversations,
  cases,
  handoffs,
  activity,
  health,
  onSelectConversation,
  onSelectCase,
  onNavigateInbox,
}: OverviewPageProps) {
  const openCaseConversationKeys = useMemo(
    () =>
      new Set(
        cases
          .filter((item) => isOpenCaseStatus(item.status))
          .map((item) => `${item.channel}:${item.conversationId}`),
      ),
    [cases],
  )

  const openHandoffConversationKeys = useMemo(
    () =>
      new Set(
        handoffs
          .filter((item) => isOpenHandoffStatus(item.status))
          .map((item) => `${item.channel}:${item.conversationId}`),
      ),
    [handoffs],
  )

  const activeConversations = conversations.filter(
    (c) => c.conversationStatus && ACTIVE_STATUSES.has(c.conversationStatus),
  )

  const waitingForCirrus = conversations.filter(
    (c) => c.conversationStatus === 'waiting_for_cirrus',
  )

  const waitingForCustomer = conversations.filter(
    (c) => c.conversationStatus === 'waiting_for_customer',
  )

  const unprocessed = conversations.filter((c) => !c.intent)

  const needsAttention = conversations.filter((c) => {
    const key = `${c.channel}:${c.conversationId}`
    return (
      openHandoffConversationKeys.has(key) ||
      c.conversationStatus === 'needs_clarification' ||
      (openCaseConversationKeys.has(key) && c.conversationStatus === 'waiting_for_cirrus')
    )
  })

  const errorComponents = health
    ? Object.entries(health).filter(([, status]) => status.state === 'error' || status.state === 'offline')
    : []

  const recentConversations = [...conversations]
    .sort((a, b) => {
      const at = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0
      const bt = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0
      return bt - at
    })
    .slice(0, 8)

  const openCases = [...cases]
    .filter((item) => isOpenCaseStatus(item.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8)

  const whatsappLast = conversations
    .filter((c) => c.channel === 'whatsapp')
    .map((c) => c.lastMessage?.timestamp)
    .filter(Boolean)
    .sort()
    .at(-1)

  const emailLast = conversations
    .filter((c) => c.channel === 'email')
    .map((c) => c.lastMessage?.timestamp)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <>
      {/* ===== Critical alerts ===== */}
      {(errorComponents.length > 0 || needsAttention.length > 0) && (
        <div className="alert-strip">
          {errorComponents.map(([name, status]) => (
            <div className="alert-chip alert-chip-error" key={name}>
              <StatusBadge status={status.state} />
              <span>{HEALTH_COMPONENT_LABEL[name] ?? name} is {status.state}</span>
            </div>
          ))}

          {needsAttention.length > 0 && (
            <div
              className="alert-chip alert-chip-warning"
              onClick={() => onNavigateInbox('needs_attention')}
            >
              <StatusBadge status="warning" />
              <span>{needsAttention.length} conversation{needsAttention.length === 1 ? '' : 's'} need attention</span>
            </div>
          )}
        </div>
      )}

      {/* ===== KPI row ===== */}
      <div className="stats stats-dense">
        <KpiCard label="Total conversations" value={overview?.conversations ?? '—'} onClick={() => onNavigateInbox('all')} />
        <KpiCard label="Active" value={activeConversations.length} onClick={() => onNavigateInbox('all')} />
        <KpiCard
          label="Waiting for Cirrus"
          value={waitingForCirrus.length}
          tone={waitingForCirrus.length > 0 ? 'warning' : 'neutral'}
          onClick={() => onNavigateInbox('waiting_for_cirrus')}
        />
        <KpiCard
          label="Waiting for customer"
          value={waitingForCustomer.length}
          onClick={() => onNavigateInbox('waiting_for_customer')}
        />
        <KpiCard
          label="Open cases"
          value={overview?.openCases ?? '—'}
          tone={overview && overview.openCases > 0 ? 'warning' : 'neutral'}
          onClick={() => onNavigateInbox('open_case')}
        />
        <KpiCard
          label="Human handoffs"
          value={overview?.openHandoffs ?? '—'}
          tone={overview && overview.openHandoffs > 0 ? 'error' : 'neutral'}
          onClick={() => onNavigateInbox('handoff')}
        />
        <KpiCard
          label="Unprocessed"
          value={unprocessed.length}
          hint="No AI analysis yet"
        />
        <KpiCard label="Total messages" value={overview?.messages ?? '—'} />
      </div>

      {/* ===== Main operational area: priority conversations | open cases | system health ===== */}
      <div className="three-col">
        <div className="panel">
          <div className="panel-header">
            <h2>Recent conversations</h2>
            <span>{conversations.length} total</span>
          </div>

          {recentConversations.length === 0 ? (
            <EmptyState title="No conversations yet" />
          ) : (
            <div className="conversation-list conversation-list-compact">
              {recentConversations.map((conversation) => {
                const meta = getChannelMeta(conversation.channel)
                return (
                  <div
                    className="conversation clickable"
                    key={`${conversation.channel}:${conversation.conversationId}`}
                    onClick={() => onSelectConversation(conversation)}
                  >
                    <div className="conversation-avatar" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      {(conversation.customerName ?? conversation.conversationId).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="conversation-content">
                      <div className="conversation-top">
                        <strong>{conversation.customerName ?? conversation.conversationId}</strong>
                        <ChannelBadge channel={conversation.channel} compact />
                      </div>
                      <p>{conversation.lastMessage?.text ?? 'No messages'}</p>
                      <div className="conversation-objective">
                        <StatusBadge status={conversation.conversationStatus} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>Open cases</h2>
            <span>{overview?.openCases ?? cases.length}</span>
          </div>

          {openCases.length === 0 ? (
            <EmptyState title="No open cases" />
          ) : (
            <div className="mini-case-list">
              {openCases.map((item) => (
                <div className="mini-case-row clickable" key={item.id} onClick={() => onSelectCase(item)}>
                  <div className="mini-case-top">
                    <ChannelBadge channel={item.channel} compact />
                    <strong>{item.customerName ?? item.conversationId}</strong>
                  </div>
                  <p>{item.equipment ?? item.summary ?? item.request ?? 'No summary'}</p>
                  <span className="mini-case-meta">{formatRelativeTime(item.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>System health</h2>
              <span>Ingestion &amp; processing</span>
            </div>
          </div>

          {!health ? (
            <EmptyState title="Health data unavailable" />
          ) : (
            <div className="health-grid health-grid-compact">
              {(Object.keys(HEALTH_COMPONENT_LABEL) as (keyof typeof HEALTH_COMPONENT_LABEL)[]).map((name) => {
                const status = health[name as keyof SystemHealth]
                return (
                  <div className="health-card" key={name}>
                    <div className="health-card-top">
                      <span>{HEALTH_COMPONENT_LABEL[name]}</span>
                      <StatusBadge status={status.state} />
                    </div>
                    <span className="health-card-meta">
                      {status.lastEventAt
                        ? `Last event ${formatRelativeTime(status.lastEventAt)}`
                        : 'No events yet'}
                    </span>
                    {status.lastError && (
                      <span className="health-card-error">{status.lastError}</span>
                    )}
                  </div>
                )
              })}

              <div className="health-card">
                <div className="health-card-top">
                  <span>
                    <ChannelBadge channel="whatsapp" compact /> channel
                  </span>
                </div>
                <span className="health-card-meta">
                  {whatsappLast ? `Last message ${formatRelativeTime(whatsappLast)}` : 'No messages yet'}
                </span>
              </div>

              <div className="health-card">
                <div className="health-card-top">
                  <span>
                    <ChannelBadge channel="email" compact /> channel
                  </span>
                </div>
                <span className="health-card-meta">
                  {emailLast ? `Last message ${formatRelativeTime(emailLast)}` : 'No messages yet'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== Activity stream =====
          Kept as its own full-width chronological section (rather than
          folded into the 3-col grid above) so it reads top-to-bottom
          uninterrupted - this is also the natural slot for a future
          conversation-volume/intent-distribution chart alongside it,
          without touching the 3-col operational grid above. */}
      <div className="panel">
        <div className="panel-header">
          <h2>Recent activity</h2>
          <span>{activity.length} events</span>
        </div>

        {activity.length === 0 ? (
          <EmptyState title="No activity yet" description="Events will appear as messages flow through the pipeline." />
        ) : (
          <div className="activity-feed activity-feed-compact">
            {activity.slice(0, 10).map((event) => (
              <div className="activity-row" key={event.id}>
                <ChannelBadge channel={event.channel} compact />
                <div className="activity-row-content">
                  <span className="activity-row-message">{event.message}</span>
                  <span className="activity-row-meta">
                    {event.type.replace(/_/g, ' ')} · {formatRelativeTime(event.timestamp)}
                  </span>
                </div>
                {event.status === 'error' && <StatusBadge status="error" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export default OverviewPage
