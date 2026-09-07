import type {
  ActivityEvent,
  ConversationDetail,
  ConversationSummary,
  HumanHandoff,
  Overview,
  ServiceCase,
  SystemHealth,
} from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(`Request failed: ${path}`)
  }

  const result = await response.json()

  if (result?.success === false) {
    throw new Error(result?.error ?? `Request failed: ${path}`)
  }

  return result.data as T
}

export function getDashboardOverview(): Promise<Overview> {
  return getJson<Overview>('/api/dashboard/overview')
}

export function getDashboardConversations(): Promise<ConversationSummary[]> {
  return getJson<ConversationSummary[]>('/api/dashboard/conversations')
}

export function getDashboardConversation(
  conversationId: string,
  channel?: string,
): Promise<ConversationDetail> {
  const query = channel
    ? `?channel=${encodeURIComponent(channel)}`
    : ''

  return getJson<ConversationDetail>(
    `/api/dashboard/conversations/${encodeURIComponent(conversationId)}${query}`,
  )
}

export function getDashboardCases(): Promise<ServiceCase[]> {
  return getJson<ServiceCase[]>('/api/dashboard/cases')
}

export function getDashboardHandoffs(): Promise<HumanHandoff[]> {
  return getJson<HumanHandoff[]>('/api/dashboard/handoffs')
}

export function getDashboardActivity(
  limit = 50,
): Promise<ActivityEvent[]> {
  return getJson<ActivityEvent[]>(
    `/api/dashboard/activity?limit=${limit}`,
  )
}

export function getDashboardHealth(): Promise<SystemHealth> {
  return getJson<SystemHealth>('/api/dashboard/health')
}