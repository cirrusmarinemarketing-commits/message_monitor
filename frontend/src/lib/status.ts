/**
 * Single source of truth for status -> color semantics across the whole
 * app (case status, handoff status, AI conversationStatus, component
 * health state). Keeping this in one place is what "use color primarily
 * for meaning, do not use random colors" actually means in practice.
 */
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const TONE_COLOR: Record<Tone, string> = {
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  info: '#2563eb',
  neutral: '#6b7280',
}

type StatusMeta = {
  label: string
  tone: Tone
  color: string
}

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  // Case / handoff lifecycle
  OPEN: { label: 'Open', tone: 'warning' },
  PENDING: { label: 'Pending', tone: 'warning' },
  ASSIGNED: { label: 'Assigned', tone: 'info' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  RESOLVED: { label: 'Resolved', tone: 'success' },
  CLOSED: { label: 'Closed', tone: 'neutral' },

  // AI conversation status
  waiting_for_cirrus: { label: 'Waiting for Cirrus', tone: 'warning' },
  waiting_for_customer: { label: 'Waiting for customer', tone: 'info' },
  normal_chat: { label: 'Casual chat', tone: 'neutral' },
  needs_clarification: { label: 'Needs clarification', tone: 'warning' },
  pending_action: { label: 'Pending action', tone: 'warning' },

  // Component / system health
  healthy: { label: 'Healthy', tone: 'success' },
  processing: { label: 'Processing', tone: 'info' },
  warning: { label: 'Warning', tone: 'warning' },
  error: { label: 'Error', tone: 'error' },
  offline: { label: 'Offline', tone: 'neutral' },
  unknown: { label: 'Unknown', tone: 'neutral' },
}

export function getStatusMeta(status: string | null | undefined): StatusMeta {
  if (!status) {
    return { label: 'Unknown', tone: 'neutral', color: TONE_COLOR.neutral }
  }

  const entry = STATUS_MAP[status]

  if (entry) {
    return { ...entry, color: TONE_COLOR[entry.tone] }
  }

  return {
    label: status.replace(/_/g, ' '),
    tone: 'neutral',
    color: TONE_COLOR.neutral,
  }
}

export function isOpenCaseStatus(status: string): boolean {
  return status === 'OPEN' || status === 'PENDING' || status === 'IN_PROGRESS'
}

export function isOpenHandoffStatus(status: string): boolean {
  return status === 'OPEN' || status === 'ASSIGNED' || status === 'IN_PROGRESS'
}
