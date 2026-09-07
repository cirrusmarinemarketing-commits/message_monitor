import type {
  ActivityEvent,
  ConversationDetail,
  ConversationSummary,
  HumanHandoff,
  Overview,
  ServiceCase,
  SystemHealth,
} from '../types'

// const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3001'
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