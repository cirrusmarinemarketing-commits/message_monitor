import type { ReactNode } from 'react'

type KpiCardProps = {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'neutral' | 'warning' | 'error' | 'success'
  onClick?: () => void
}

function KpiCard({ label, value, hint, tone = 'neutral', onClick }: KpiCardProps) {
  return (
    <div
      className={`kpi-card kpi-card-${tone}${onClick ? ' kpi-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <span className="kpi-label">{label}</span>
      <strong className="kpi-value">{value}</strong>
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  )
}

export default KpiCard
