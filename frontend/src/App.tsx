import { useMemo, useState } from 'react'
import './App.css'
import type { ConversationSummary, HumanHandoff, ServiceCase } from './types'
import { useDashboardData } from './hooks/useDashboardData'
import { isOpenCaseStatus, isOpenHandoffStatus } from './lib/status'
import Sidebar, { type View } from './components/Sidebar'
import ConversationDrawer from './components/ConversationDrawer'
import FreshnessBar from './components/ui/FreshnessBar'
import ErrorState from './components/ui/ErrorState'
import Skeleton from './components/ui/Skeleton'
import OverviewPage from './pages/OverviewPage'
import InboxPage, { type InboxFilter } from './pages/InboxPage'
import CasesPage from './pages/CasesPage'
import HandoffsPage from './pages/HandoffsPage'
import ActivityPage from './pages/ActivityPage'

type SelectedConversation = {
  conversationId: string
  channel: string
  customerName: string | null
}

const PAGE_TITLES: Record<View, string> = {
  overview: 'Overview',
  inbox: 'Inbox',
  cases: 'Service Cases',
  handoffs: 'Human Handoffs',
  activity: 'Activity Monitor',
}

const PAGE_SUBTITLES: Record<View, string> = {
  overview: 'Unified WhatsApp + Email operations at a glance',
  inbox: 'Every conversation, one queue, both channels',
  cases: 'Service requests that need work',
  handoffs: 'Conversations waiting on a human',
  activity: 'Live pipeline event stream',
}

function App() {
  const {
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
    refresh,
  } = useDashboardData()

  const [view, setView] = useState<View>('overview')
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all')
  const [selected, setSelected] = useState<SelectedConversation | null>(null)

  const openCaseCount = cases.filter((item) => isOpenCaseStatus(item.status)).length
  const openHandoffCount = handoffs.filter((item) => isOpenHandoffStatus(item.status)).length

  const urgentCount = useMemo(() => {
    const openHandoffKeys = new Set(
      handoffs
        .filter((item) => isOpenHandoffStatus(item.status))
        .map((item) => `${item.channel}:${item.conversationId}`),
    )

    return conversations.filter((c) => openHandoffKeys.has(`${c.channel}:${c.conversationId}`)).length
  }, [conversations, handoffs])

  const handleSelectConversation = (conversation: ConversationSummary) => {
    setSelected({
      conversationId: conversation.conversationId,
      channel: conversation.channel,
      customerName: conversation.customerName,
    })
  }

  const handleSelectCase = (item: ServiceCase) => {
    setSelected({
      conversationId: item.conversationId,
      channel: item.channel,
      customerName: item.customerName,
    })
  }

  const handleSelectHandoff = (item: HumanHandoff) => {
    setSelected({
      conversationId: item.conversationId,
      channel: item.channel,
      customerName: item.customerName,
    })
  }

  const handleNavigateInbox = (filter: InboxFilter) => {
    setInboxFilter(filter)
    setView('inbox')
  }

  const selectedCase = selected
    ? cases.find(
      (item) => item.conversationId === selected.conversationId && item.channel === selected.channel,
    ) ?? null
    : null

  const selectedHandoff = selected
    ? handoffs.find(
      (item) => item.conversationId === selected.conversationId && item.channel === selected.channel,
    ) ?? null
    : null

  return (
    <div className="app">
      <Sidebar
        active={view}
        onNavigate={setView}
        counts={{
          inbox: conversations.length,
          cases: openCaseCount,
          handoffs: openHandoffCount,
        }}
        urgentCount={urgentCount}
      />

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{PAGE_TITLES[view]}</h1>
            <p>{PAGE_SUBTITLES[view]}</p>
          </div>

          <FreshnessBar online={online} stale={stale} lastUpdatedAt={lastUpdatedAt} onRefresh={refresh} />
        </header>

        <section className="content">
          {error && <ErrorState message={error} onRetry={refresh} />}

          {loading ? (
            <div className="panel">
              <Skeleton rows={6} />
            </div>
          ) : (
            <>
              {view === 'overview' && (
                <OverviewPage
                  overview={overview}
                  conversations={conversations}
                  cases={cases}
                  handoffs={handoffs}
                  activity={activity}
                  health={health}
                  onSelectConversation={handleSelectConversation}
                  onNavigateInbox={handleNavigateInbox}
                />
              )}

              {view === 'inbox' && (
                <InboxPage
                  conversations={conversations}
                  cases={cases}
                  handoffs={handoffs}
                  initialFilter={inboxFilter}
                  onSelect={handleSelectConversation}
                />
              )}

              {view === 'cases' && <CasesPage cases={cases} onSelect={handleSelectCase} />}

              {view === 'handoffs' && (
                <HandoffsPage handoffs={handoffs} onSelect={handleSelectHandoff} />
              )}

              {view === 'activity' && <ActivityPage activity={activity} />}
            </>
          )}
        </section>
      </main>

      {selected && (
        <ConversationDrawer
          key={`${selected.channel}:${selected.conversationId}`}
          conversationId={selected.conversationId}
          channel={selected.channel}
          customerName={selected.customerName}
          serviceCase={selectedCase}
          handoff={selectedHandoff}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}

export default App
