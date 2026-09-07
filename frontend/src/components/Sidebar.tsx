export type View = 'overview' | 'inbox' | 'cases' | 'handoffs' | 'activity'

type NavItem = {
  id: View
  label: string
}

type SidebarProps = {
  active: View
  onNavigate: (view: View) => void
  counts: Partial<Record<View, number>>
  urgentCount: number
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'cases', label: 'Cases' },
  { id: 'handoffs', label: 'Human Handoffs' },
  { id: 'activity', label: 'Activity' },
]

function Sidebar({ active, onNavigate, counts, urgentCount }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">M</div>
        <div>
          <strong>Message Monitor</strong>
          <span>Operations Console</span>
        </div>
      </div>

      {urgentCount > 0 && (
        <div className="sidebar-alert" onClick={() => onNavigate('inbox')}>
          <span className="sidebar-alert-dot" />
          {urgentCount} conversation{urgentCount === 1 ? '' : 's'} need attention
        </div>
      )}

      <nav>
        {NAV_ITEMS.map((item) => (
          <a
            key={item.id}
            className={item.id === active ? 'active' : ''}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.label}</span>
            {!!counts[item.id] && <span className="nav-count">{counts[item.id]}</span>}
          </a>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <span>Channels</span>
        <div className="sidebar-channels">
          <span className="sidebar-channel-dot sidebar-channel-whatsapp" /> WhatsApp
          <span className="sidebar-channel-dot sidebar-channel-email" /> Email
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
