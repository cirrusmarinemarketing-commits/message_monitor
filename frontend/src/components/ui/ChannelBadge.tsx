import type { Channel } from '../../types'
import { getChannelMeta } from '../../lib/channel'

type ChannelBadgeProps = {
  channel: Channel | null | undefined
  compact?: boolean
}

function ChannelBadge({ channel, compact = false }: ChannelBadgeProps) {
  const meta = getChannelMeta(channel)

  return (
    <span
      className={`channel-badge${compact ? ' channel-badge-compact' : ''}`}
      style={{ color: meta.color, background: `${meta.color}1a` }}
      title={meta.label}
    >
      <span className="channel-badge-glyph">{meta.glyph}</span>
      {!compact && meta.label}
    </span>
  )
}

export default ChannelBadge
