import type { ConversationSummary, HumanHandoffStatus, ServiceCaseStatus } from '../types'

export type Priority = 'urgent' | 'high' | 'normal' | 'low'

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: '#d8393f' },
  high: { label: 'High', color: '#c1750f' },
  normal: { label: 'Normal', color: '#3457e0' },
  low: { label: 'Low', color: '#97a1ac' },
}

const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
}

export function comparePriority(a: Priority, b: Priority): number {
  return PRIORITY_RANK[a] - PRIORITY_RANK[b]
}

/**
 * Operational priority for a conversation, given whether it currently has
 * an open case and/or an open human handoff attached. A handoff always
 * wins - a human explicitly asked for a person.
 */
export function getConversationPriority(
  conversation: ConversationSummary,
  hasOpenHandoff: boolean,
  hasOpenCase: boolean,
): Priority {
  if (hasOpenHandoff) return 'urgent'

  if (conversation.conversationStatus === 'needs_clarification') return 'high'
  if (hasOpenCase) return 'high'
  if (conversation.conversationStatus === 'waiting_for_cirrus') return 'high'
  if (conversation.conversationStatus === 'pending_action') return 'normal'

  return 'low'
}

export function getCasePriority(status: ServiceCaseStatus): Priority {
  if (status === 'OPEN') return 'high'
  if (status === 'PENDING' || status === 'IN_PROGRESS') return 'normal'
  return 'low'
}

export function getHandoffPriority(status: HumanHandoffStatus): Priority {
  if (status === 'OPEN') return 'urgent'
  if (status === 'ASSIGNED' || status === 'IN_PROGRESS') return 'high'
  return 'low'
}
