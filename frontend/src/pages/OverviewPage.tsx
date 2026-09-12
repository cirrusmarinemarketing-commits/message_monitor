import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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

// 7-day conversation volume by channel, built from the real activity
// stream (recharts is already a project dependency - this is the slot
// the original code comment flagged for it).
const VOLUME_DAYS = 7

function buildVolumeSeries(activity: ActivityEvent[]) {
  const days: { key: string; label: string; whatsapp: number; email: number }[] = []
  const now = new Date()

  for (let i = VOLUME_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      whatsapp: 0,
      email: 0,
    })
  }

  const byKey = new Map(days.map((d) => [d.key, d]))

  for (const event of activity) {
    const key = new Date(event.timestamp).toISOString().slice(0, 10)
    const bucket = byKey.get(key)
    if (!bucket) continue
    if (event.channel === 'whatsapp') bucket.whatsapp += 1
    else if (event.channel === 'email') bucket.email += 1
  }

  return days
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

  const hasIssues = errorComponents.length > 0 || needsAttention.length > 0

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

  const volumeDays = useMemo(() => buildVolumeSeries(activity), [activity])
  const volumeTotal = volumeDays.reduce((sum, d) => sum + d.whatsapp + d.email, 0)

  return (
    <>
      {/* ===== Status banner - always present, not just when something's wrong ===== */}
      <div className={`status-banner${hasIssues ? ' status-banner-issues' : ''}`}>
        <span className="status-banner-dot" />
        <span>{hasIssues ? 'Attention needed' : 'All systems operational'}</span>

        <div className="status-banner-chips">
          {errorComponents.map(([name, status]) => (
            <span className="status-chip status-chip-error" key={name}>
              <StatusBadge status={status.state} compact />
              {HEALTH_COMPONENT_LABEL[name] ?? name} {status.state}
            </span>
          ))}

          {needsAttention.length > 0 && (
            <span
              className="status-chip status-chip-warning clickable"
              onClick={() => onNavigateInbox('needs_attention')}
            >
              {needsAttention.length} need{needsAttention.length === 1 ? 's' : ''} attention
            </span>
          )}

          {!hasIssues && (
            <>
              <span className="status-chip">WhatsApp OK</span>
              <span className="status-chip">Gmail OK</span>
              <span className="status-chip">AI OK</span>
            </>
          )}
        </div>
      </div>

      {/* ===== Primary KPIs - the metrics that actually require action ===== */}
      <div className="kpi-primary">
        <KpiCard
          label="Waiting for Cirrus"
          value={waitingForCirrus.length}
          tone={waitingForCirrus.length > 0 ? 'warning' : 'neutral'}
          hint="Needs a reply to move forward"
          size="large"
          onClick={() => onNavigateInbox('waiting_for_cirrus')}
        />
        <KpiCard
          label="Human handoffs"
          value={overview?.openHandoffs ?? '—'}
          tone={overview && overview.openHandoffs > 0 ? 'error' : 'neutral'}
          hint="Open - requires a person"
          size="large"
          onClick={() => onNavigateInbox('handoff')}
        />
        <KpiCard
          label="Open cases"
          value={overview?.openCases ?? '—'}
          tone={overview && overview.openCases > 0 ? 'warning' : 'neutral'}
          size="large"
          onClick={() => onNavigateInbox('open_case')}
        />
      </div>

      {/* ===== Secondary KPIs - compact strip, still visible, lower visual weight ===== */}
      <div className="kpi-secondary">
        <div className="kpi-mini clickable" onClick={() => onNavigateInbox('all')}>
          <div className="kpi-mini-value">{overview?.conversations ?? '—'}</div>
          <div className="kpi-mini-label">Total conversations</div>
        </div>
        <div className="kpi-mini clickable" onClick={() => onNavigateInbox('all')}>
          <div className="kpi-mini-value">{activeConversations.length}</div>
          <div className="kpi-mini-label">Active</div>
        </div>
        <div className="kpi-mini clickable" onClick={() => onNavigateInbox('waiting_for_customer')}>
          <div className="kpi-mini-value">{waitingForCustomer.length}</div>
          <div className="kpi-mini-label">Waiting for customer</div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-value">{unprocessed.length}</div>
          <div className="kpi-mini-label">Unprocessed</div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-value">{overview?.messages ?? '—'}</div>
          <div className="kpi-mini-label">Total messages</div>
        </div>
      </div>

      {/* ===== Conversation volume - real data, grouped from the activity stream ===== */}
      <div className="panel chart-card">
        <div className="panel-header">
          <h2>Conversation volume</h2>
          <div className="legend-inline">
            <span><span className="legend-dot legend-dot-whatsapp" />WhatsApp</span>
            <span><span className="legend-dot legend-dot-email" />Email</span>
          </div>
        </div>
        <p className="chart-sub">{volumeTotal} events in the last {VOLUME_DAYS} days, by channel</p>

        {volumeTotal === 0 ? (
          <EmptyState title="No activity yet" description="Volume will appear once events start flowing through the pipeline." />
        ) : (
          <div className="chart-area">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={volumeDays} barCategoryGap={18}>
                <CartesianGrid vertical={false} stroke="var(--color-border-soft)" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--color-text-faint)', fontSize: 11 }}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: 'var(--color-surface-alt)' }}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid var(--color-border)',
                    fontSize: 12,
                    boxShadow: 'var(--shadow-md)',
                  }}
                />
                <Bar
                  dataKey="whatsapp"
                  name="WhatsApp"
                  stackId="volume"
                  fill={getChannelMeta('whatsapp').color}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="email"
                  name="Email"
                  stackId="volume"
                  fill={getChannelMeta('email').color}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ===== Main operational area: conversations (wide) | cases + health (stacked, narrow) ===== */}
      <div className="main-grid">
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

        <div>
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
              <>
                <div className="health-sub-label">Pipeline components</div>
                <div className="health-list">
                  {(Object.keys(HEALTH_COMPONENT_LABEL) as (keyof typeof HEALTH_COMPONENT_LABEL)[]).map((name) => {
                    const status = health[name as keyof SystemHealth]
                    return (
                      <div className="health-row" key={name}>
                        <span className="health-row-name">
                          <StatusBadge status={status.state} compact />
                          {HEALTH_COMPONENT_LABEL[name]}
                        </span>
                        <span className="health-row-meta">
                          {status.lastEventAt ? formatRelativeTime(status.lastEventAt) : 'No events yet'}
                        </span>
                        {status.lastError && (
                          <span className="health-card-error">{status.lastError}</span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="health-sub-label">Channel activity</div>
                <div className="health-list">
                  <div className="health-row">
                    <span className="health-row-name"><ChannelBadge channel="whatsapp" compact /> WhatsApp</span>
                    <span className="health-row-meta">
                      {whatsappLast ? `Last message ${formatRelativeTime(whatsappLast)}` : 'No messages yet'}
                    </span>
                  </div>
                  <div className="health-row">
                    <span className="health-row-name"><ChannelBadge channel="email" compact /> Email</span>
                    <span className="health-row-meta">
                      {emailLast ? `Last message ${formatRelativeTime(emailLast)}` : 'No messages yet'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== Activity stream =====
          Kept as its own full-width chronological section below the
          weighted operational grid, so it reads top-to-bottom
          uninterrupted after the volume chart above. */}
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
