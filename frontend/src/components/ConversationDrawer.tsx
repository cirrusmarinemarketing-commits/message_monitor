import { useEffect, useState } from 'react'
import type { ConversationDetail, HumanHandoff, ServiceCase } from '../types'
import { getDashboardConversation } from '../services/dashboard.service'
import { getIntentMeta, getActionLabel } from '../lib/intent'
import { formatDateTime, formatRelativeTime } from '../lib/format'
import ChannelBadge from './ui/ChannelBadge'
import StatusBadge from './ui/StatusBadge'
import Badge from './ui/Badge'
import Drawer from './ui/Drawer'
import Skeleton from './ui/Skeleton'
import ErrorState from './ui/ErrorState'

type ConversationDrawerProps = {
  conversationId: string
  channel: string
  customerName: string | null
  serviceCase: ServiceCase | null
  handoff: HumanHandoff | null
  onClose: () => void
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <p className="field-value">{value}</p>
    </div>
  )
}

function ConversationDrawer({
  conversationId,
  channel,
  customerName,
  serviceCase,
  handoff,
  onClose,
}: ConversationDrawerProps) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // No synchronous setState here: this component is fully remounted on
    // conversationId/channel change (see the `key` prop in App.tsx), so
    // the loading/error useState initializers above already give a fresh
    // "loading, no error" state for every conversation without needing to
    // reset it again here.
    let cancelled = false

    getDashboardConversation(conversationId, channel)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
      })
      .catch(() => {
        if (cancelled) return
        setError('Unable to load this conversation.')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [conversationId, channel])

  const analysis = detail?.analysis ?? null
  const intentMeta = getIntentMeta(analysis?.intent ?? detail?.intent)
  const lastMessage = detail?.messages[detail.messages.length - 1]

  return (
    <Drawer onClose={onClose} wide>
      <div className="drawer-header">
        <div>
          <span className="drawer-eyebrow">Conversation</span>
          <h2>{customerName ?? conversationId}</h2>
          <div className="drawer-header-tags">
            <ChannelBadge channel={channel as 'whatsapp' | 'email'} />
            <StatusBadge status={detail?.conversationStatus} />
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {loading && (
        <div className="drawer-body">
          <Skeleton rows={5} />
        </div>
      )}

      {!loading && error && (
        <div className="drawer-body">
          <ErrorState message={error} />
        </div>
      )}

      {!loading && !error && detail && (
        <div className="drawer-columns">
          {/* ===== 1. Conversation timeline ===== */}
          <div className="drawer-column drawer-column-timeline">
            <h3 className="drawer-section-title">Timeline</h3>

            {detail.messages.length === 0 ? (
              <p className="muted">No messages found for this conversation.</p>
            ) : (
              <div className="message-thread">
                {detail.messages.map((message, index) => (
                  <div
                    key={message.id ?? index}
                    className={`bubble bubble-${message.role}`}
                  >
                    {message.senderName && (
                      <span className="bubble-sender">{message.senderName}</span>
                    )}
                    {message.subject && (
                      <span className="bubble-subject">{message.subject}</span>
                    )}
                    <p>{message.text}</p>
                    <span className="bubble-time">{formatDateTime(message.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== Right column: structured investigation panels ===== */}
          <div className="drawer-column drawer-column-info">
            {/* 2. Customer information */}
            <section className="info-panel">
              <h3 className="drawer-section-title">Customer</h3>
              <Field label="Name" value={customerName ?? 'Unknown'} />
              <Field label="Conversation ID" value={conversationId} />
              {lastMessage?.from && <Field label="From" value={lastMessage.from} />}
              {lastMessage?.to && <Field label="To" value={lastMessage.to} />}
            </section>

            {/* 3. AI analysis */}
            <section className="info-panel">
              <h3 className="drawer-section-title">AI Analysis</h3>

              {!analysis ? (
                <p className="muted">
                  No AI analysis yet - this conversation hasn't been processed.
                </p>
              ) : (
                <>
                  <div className="field">
                    <span className="field-label">Intent</span>
                    <p className="field-value">
                      <Badge label={intentMeta.label} color={intentMeta.color} />
                    </p>
                  </div>
                  <Field label="Summary" value={analysis.summary} />
                  <Field label="Equipment" value={analysis.equipment} />
                  <Field label="Problem" value={analysis.problem} />
                  <Field label="Location" value={analysis.location} />
                  <Field label="Request" value={analysis.request} />
                  <Field label="Amount" value={analysis.amount} />
                  <Field label="Customer position" value={analysis.customer_position} />
                  <Field label="Cirrus position" value={analysis.cirrus_position} />
                  <div className="field">
                    <span className="field-label">Conversation status</span>
                    <p className="field-value">
                      <StatusBadge status={analysis.conversation_status} />
                    </p>
                  </div>
                </>
              )}
            </section>

            {/* 4. Business decision */}
            {analysis?.action && (
              <section className="info-panel info-panel-highlight">
                <h3 className="drawer-section-title">AI Decision</h3>
                <p className="field-value field-value-large">
                  {getActionLabel(analysis.action)}
                </p>
                {analysis.pending_action && (
                  <div className="field">
                    <span className="field-label">Pending action</span>
                    <p className="field-value">{analysis.pending_action}</p>
                  </div>
                )}
              </section>
            )}

            {/* 5. Case information */}
            {serviceCase && (
              <section className="info-panel">
                <h3 className="drawer-section-title">Service Case</h3>
                <div className="field">
                  <span className="field-label">Status</span>
                  <p className="field-value">
                    <StatusBadge status={serviceCase.status} />
                  </p>
                </div>
                <Field label="Case ID" value={serviceCase.id} />
                <Field label="Created" value={formatRelativeTime(serviceCase.createdAt)} />
              </section>
            )}

            {/* 7. Human handoff */}
            {handoff && (
              <section className="info-panel info-panel-urgent">
                <h3 className="drawer-section-title">Human Handoff</h3>
                <div className="field">
                  <span className="field-label">Status</span>
                  <p className="field-value">
                    <StatusBadge status={handoff.status} />
                  </p>
                </div>
                <Field label="Reason" value={handoff.reason} />
                <Field label="Assigned to" value={handoff.assignedTo ?? 'Unassigned'} />
                <Field label="Created" value={formatRelativeTime(handoff.createdAt)} />
              </section>
            )}

            {/* 8. Channel information */}
            <section className="info-panel">
              <h3 className="drawer-section-title">Channel</h3>
              <div className="field">
                <span className="field-label">Source</span>
                <p className="field-value">
                  <ChannelBadge channel={channel as 'whatsapp' | 'email'} />
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
    </Drawer>
  )
}

export default ConversationDrawer
