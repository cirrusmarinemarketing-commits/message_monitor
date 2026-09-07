import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getDashboardActivity,
  getDashboardCases,
  getDashboardConversations,
  getDashboardHandoffs,
  getDashboardHealth,
  getDashboardOverview,
} from '../services/dashboard.service'
import type {
  ActivityEvent,
  ConversationSummary,
  HumanHandoff,
  Overview,
  ServiceCase,
  SystemHealth,
} from '../types'

const REFRESH_MS = 15000
const STALE_AFTER_MS = REFRESH_MS * 3

export type DashboardData = {
  overview: Overview | null
  conversations: ConversationSummary[]
  cases: ServiceCase[]
  handoffs: HumanHandoff[]
  activity: ActivityEvent[]
  health: SystemHealth | null
  loading: boolean
  online: boolean
  error: string
  lastUpdatedAt: number | null
  stale: boolean
  refresh: () => void
}

export function useDashboardData(): DashboardData {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [cases, setCases] = useState<ServiceCase[]>([])
  const [handoffs, setHandoffs] = useState<HumanHandoff[]>([])
  const [activity, setActivity] = useState<ActivityEvent[]>([])
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [stale, setStale] = useState(false)

  const inFlight = useRef(false)

  const load = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true

    Promise.all([
      getDashboardOverview(),
      getDashboardConversations(),
      getDashboardCases(),
      getDashboardHandoffs(),
      getDashboardActivity(50),
      getDashboardHealth(),
    ])
      .then(([overviewData, conversationData, caseData, handoffData, activityData, healthData]) => {
        setOverview(overviewData)
        setConversations(conversationData)
        setCases(caseData)
        setHandoffs(handoffData)
        setActivity(activityData)
        setHealth(healthData)
        setOnline(true)
        setError('')
        setLastUpdatedAt(Date.now())
      })
      .catch(() => {
        setOnline(false)
        setError('Unable to connect to backend')
      })
      .finally(() => {
        setLoading(false)
        inFlight.current = false
      })
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const check = () => {
      setStale(
        lastUpdatedAt !== null && Date.now() - lastUpdatedAt > STALE_AFTER_MS,
      )
    }

    check()
    const interval = setInterval(check, 5000)
    return () => clearInterval(interval)
  }, [lastUpdatedAt])

  return {
    overview,
    conversations,
    cases,
    handoffs,
    activity,
    health,
    loading,
    online,
    error,
    lastUpdatedAt,
    stale,
    refresh: load,
  }
}
