export type Channel = 'whatsapp' | 'email'

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

export type BusinessAction =
  | 'RESPOND'
  | 'ASK_CLARIFICATION'
  | 'HANDOFF_TO_HUMAN'
  | 'COLLECT_INFORMATION'
  | 'CREATE_CASE'
  | 'WAIT'
  | 'NO_ACTION'

export type Overview = {
  conversations: number
  messages: number
  cases: number
  openCases: number
  handoffs: number
  openHandoffs: number
}

export type Message = {
  role: 'customer' | 'cirrus'
  senderName?: string | null
  id?: string | null
  from?: string | null
  to?: string | null
  timestamp?: string | null
  type?: string | null
  text?: string | null
  channel?: Channel | null
  subject?: string | null
  conversationId?: string | null
}

export type AIAnalysis = {
  intent: Intent | string | null
  action: BusinessAction | string | null
  equipment: string | null
  problem: string | null
  location: string | null
  request: string | null
  amount: string | null
  summary: string | null
  customer_position: string | null
  cirrus_position: string | null
  pending_action: string | null
  conversation_status: string | null
}

/** conversationId + channel is the canonical identity of a conversation. */
export type ConversationSummary = {
  channel: Channel
  conversationId: string
  customerName: string | null
  messageCount: number
  lastMessage: Message | null
  intent: Intent | string | null
  summary: string | null
  conversationStatus: string | null
  action: BusinessAction | string | null
}

export type ConversationDetail = {
  channel: Channel
  conversationId: string
  customerName: string | null
  messages: Message[]
  intent: Intent | string | null
  summary: string | null
  conversationStatus: string | null
  analysis: AIAnalysis | null
}

export type ServiceCaseStatus =
  | 'OPEN'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'

export type ServiceCase = {
  id: string
  conversationId: string
  channel: Channel
  waId: string | null
  customerName: string | null
  intent: string | null
  equipment: string | null
  problem: string | null
  location: string | null
  request: string | null
  summary: string | null
  status: ServiceCaseStatus
  createdAt: string
}

export type HumanHandoffStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'

export type HumanHandoff = {
  id: string
  conversationId: string
  channel: Channel
  waId: string | null
  customerName: string | null
  intent: string | null
  problem: string | null
  request: string | null
  reason: string | null
  status: HumanHandoffStatus
  assignedTo: string | null
  createdAt: string
}

export type ActivityEventType =
  | 'whatsapp_received'
  | 'gmail_received'
  | 'conversation_updated'
  | 'ai_analysis_completed'
  | 'business_action_generated'
  | 'case_created'
  | 'handoff_created'
  | 'response_generated'
  | 'processing_error'

export type ActivityEvent = {
  id: string
  timestamp: string
  channel: Channel | null
  type: ActivityEventType
  conversationId: string | null
  customerName: string | null
  status: 'success' | 'error'
  message: string
}

export type ComponentState =
  | 'healthy'
  | 'processing'
  | 'warning'
  | 'error'
  | 'offline'
  | 'unknown'

export type ComponentStatus = {
  state: ComponentState
  lastEventAt: string | null
  lastError: string | null
}

export type ComponentName = 'whatsapp' | 'gmail' | 'ai' | 'pipeline'

export type SystemHealth = Record<ComponentName, ComponentStatus>

/** Derived, per-conversation view of what the customer is trying to accomplish. */
export type ConversationObjective = {
  intent: string | null
  summary: string | null
  status: string | null
}
