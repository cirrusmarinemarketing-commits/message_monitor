import type { Channel } from '../types'

type ChannelMeta = {
  label: string
  color: string
  glyph: string
}

const CHANNEL_META: Record<Channel, ChannelMeta> = {
  whatsapp: { label: 'WhatsApp', color: '#178a56', glyph: 'W' },
  email: { label: 'Email', color: '#3457e0', glyph: '@' },
}

export function getChannelMeta(channel: Channel | null | undefined): ChannelMeta {
  if (channel && channel in CHANNEL_META) {
    return CHANNEL_META[channel]
  }

  return { label: 'Unknown', color: '#6b7686', glyph: '?' }
}
