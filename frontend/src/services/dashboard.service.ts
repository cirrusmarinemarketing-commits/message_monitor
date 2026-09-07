import type {
  ActivityEvent,
  ConversationDetail,
  ConversationSummary,
  HumanHandoff,
  Overview,
  ServiceCase,
  SystemHealth,
} from '../types'
import 'dotenv'

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001'

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

export function getDashboardOverview() {
  return getJson<Overview>('/api/dashboard/overview')
}

export function getDashboardConversations() {
  return getJson<ConversationSummary[]>('/api/dashboard/conversations')
}

export function getDashboardConversation(conversationId: string) {
  return getJson<ConversationDetail>(
    `/api/dashboard/conversations/${encodeURIComponent(conversationId)}`,
  )
}

export function getDashboardCases() {
  return getJson<ServiceCase[]>('/api/dashboard/cases')
}

export function getDashboardHandoffs() {
  return getJson<HumanHandoff[]>('/api/dashboard/handoffs')
}

export function getDashboardActivity(limit = 50) {
  return getJson<ActivityEvent[]>(`/api/dashboard/activity?limit=${limit}`)
}

export function getDashboardHealth() {
  return getJson<SystemHealth>('/api/dashboard/health')
}
