type BadgeProps = {
  label: string
  color: string
  dot?: boolean
}

/** Low-level colored pill. Prefer the semantic wrappers (StatusBadge, ChannelBadge, PriorityBadge) over using this directly. */
function Badge({ label, color, dot = true }: BadgeProps) {
  return (
    <span
      className="badge"
      style={{
        color,
        background: `${color}1a`,
        borderColor: `${color}40`,
      }}
    >
      {dot && <span className="badge-dot" style={{ background: color }} />}
      {label}
    </span>
  )
}

export default Badge
