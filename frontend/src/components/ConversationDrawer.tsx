import { useEffect, useRef, useState } from 'react'
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!detail?.messages?.length) return

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'end',
      })
    })
  }, [detail?.conversationId, detail?.messages?.length])

  const analysis = detail?.analysis ?? null
  const intentMeta = getIntentMeta(analysis?.intent ?? detail?.intent)
  const lastMessage = detail?.messages[detail.messages.length - 1]

  return (
    <Drawer onClose={onClose} wide>
      <div className="drawer-header">
        <div>
          <span className="drawer-eyebrow">Conversation</span>
          <h2>
            {customerName ?? conversationId}
            {detail?.groupId && <span className="group-badge">Group</span>}
          </h2>
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

                <div ref={messagesEndRef} />
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

            {/* 3. AI analysis - restructured so the gist reads in one
                glance: status + intent up top, summary as a lead
                sentence, compact facts in a scannable grid, and the two
                negotiation positions paired side-by-side instead of
                buried in a single stacked list of 10 equal-weight fields. */}
            <section className="info-panel">
              <h3 className="drawer-section-title">AI Analysis</h3>

              {!analysis ? (
                <p className="muted">
                  No AI analysis yet - this conversation hasn't been processed.
                </p>
              ) : (
                <>
                  <div className="analysis-top-row">
                    <Badge label={intentMeta.label} color={intentMeta.color} />
                    <StatusBadge status={analysis.conversation_status} />
                  </div>

                  {analysis.summary && (
                    <p className="analysis-summary">{analysis.summary}</p>
                  )}

                  {(analysis.equipment || analysis.problem || analysis.location || analysis.amount) && (
                    <div className="field-grid">
                      {analysis.equipment && (
                        <div className="field">
                          <span className="field-label">Equipment</span>
                          <p className="field-value">{analysis.equipment}</p>
                        </div>
                      )}
                      {analysis.location && (
                        <div className="field">
                          <span className="field-label">Location</span>
                          <p className="field-value">{analysis.location}</p>
                        </div>
                      )}
                      {analysis.problem && (
                        <div className="field field-span-2">
                          <span className="field-label">Problem</span>
                          <p className="field-value">{analysis.problem}</p>
                        </div>
                      )}
                      {analysis.amount && (
                        <div className="field">
                          <span className="field-label">Amount</span>
                          <p className="field-value">{analysis.amount}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <Field label="Request" value={analysis.request} />

                  {(analysis.customer_position || analysis.cirrus_position) && (
                    <div className="position-compare">
                      <div className="position-card">
                        <span className="field-label">Customer position</span>
                        <p className="field-value">{analysis.customer_position ?? '—'}</p>
                      </div>
                      <div className="position-card position-card-cirrus">
                        <span className="field-label">Cirrus position</span>
                        <p className="field-value">{analysis.cirrus_position ?? '—'}</p>
                      </div>
                    </div>
                  )}
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
