import type { Intent } from '../types'

type IntentMeta = {
  label: string
  color: string
}

const INTENT_META: Record<Intent, IntentMeta> = {
  service_request: { label: 'Service request', color: '#2563eb' },
  quotation_request: { label: 'Quotation request', color: '#7c3aed' },
  parts_inquiry: { label: 'Parts inquiry', color: '#16a34a' },
  payment_inquiry: { label: 'Payment inquiry', color: '#f59e0b' },
  refund_request: { label: 'Refund request', color: '#dc2626' },
  technical_support: { label: 'Technical support', color: '#eab308' },
  follow_up: { label: 'Follow-up', color: '#06b6d4' },
  complaint: { label: 'Complaint', color: '#b91c1c' },
  general_inquiry: { label: 'General inquiry', color: '#64748b' },
  normal_chat: { label: 'Casual chat', color: '#475569' },
  needs_clarification: { label: 'Needs clarification', color: '#d97706' },
}

export function getIntentMeta(intent: Intent | string | null | undefined): IntentMeta {
  if (!intent || !(intent in INTENT_META)) {
    return { label: intent ? intent.replace(/_/g, ' ') : 'Uncategorized', color: '#9ca3af' }
  }

  return INTENT_META[intent as Intent]
}

const ACTION_LABELS: Record<string, string> = {
  RESPOND: 'Respond',
  ASK_CLARIFICATION: 'Ask clarification',
  HANDOFF_TO_HUMAN: 'Human handoff',
  COLLECT_INFORMATION: 'Collect information',
  CREATE_CASE: 'Create case',
  WAIT: 'Wait',
  NO_ACTION: 'No action',
}

export function getActionLabel(action: string | null | undefined): string {
  if (!action) return 'Unknown'
  return ACTION_LABELS[action] ?? action.replace(/_/g, ' ')
}
