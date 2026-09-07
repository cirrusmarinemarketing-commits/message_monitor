import type { Channel } from './communication'

export type Intent =
    | 'quotation_request'
    | 'service_request'
    | 'refund_request'
    | 'technical_support'
    | 'parts_inquiry'
    | 'general_inquiry'
    | 'complaint'
    | 'follow_up'
    | 'payment_inquiry'
    | 'normal_chat'
    | 'needs_clarification'

export type ConversationSummary = {
    conversationId: string
    channel: Channel
    waId: string | null
    customerName?: string | null
    messageCount: number
    lastMessage: {
        role: 'customer' | 'cirrus'
        id?: string | null
        from?: string | null
        timestamp?: string | null
        type?: string | null
        text?: string | null
    } | null

    intent: Intent | null
    summary: string | null
    conversationStatus: string | null
}

export type Overview = {
    conversations: number
    messages: number
    cases: number
    openCases: number
    handoffs: number
    openHandoffs: number
}

export type ServiceCase = {
    id: string
    conversationId: string
    channel: Channel
    waId: string | null
    customerName?: string | null
    status: string
    summary?: string | null
    request?: string | null
    problem?: string | null
    equipment?: string | null
    location?: string | null
    createdAt: string
}

export type HumanHandoff = {
    id: string
    conversationId: string
    channel: Channel
    waId: string | null
    customerName?: string | null
    status: string
    intent: Intent | null
    reason?: string | null
    request?: string | null
    problem?: string | null
    assignedTo?: string | null
    createdAt: string
}

export type ConversationObjective = {
    intent: Intent
    summary: string | null
    source: 'ai'
    status: string | null
    createdAt?: string | null
}