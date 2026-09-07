import type { Channel } from '../types'

type ChannelMeta = {
  label: string
  color: string
  glyph: string
}

const CHANNEL_META: Record<Channel, ChannelMeta> = {
  whatsapp: { label: 'WhatsApp', color: '#16a34a', glyph: 'W' },
  email: { label: 'Email', color: '#2563eb', glyph: '@' },
}

export function getChannelMeta(channel: Channel | null | undefined): ChannelMeta {
  if (channel && channel in CHANNEL_META) {
    return CHANNEL_META[channel]
  }

  return { label: 'Unknown', color: '#6b7280', glyph: '?' }
}
