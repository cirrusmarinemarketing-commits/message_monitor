import type { Channel } from "../types/communication";

export type ActivityEventType =
    | "whatsapp_received"
    | "gmail_received"
    | "conversation_updated"
    | "ai_analysis_completed"
    | "business_action_generated"
    | "case_created"
    | "handoff_created"
    | "response_generated"
    | "processing_error";

export type ActivityEvent = {
    id: string;
    timestamp: string;
    channel: Channel | null;
    type: ActivityEventType;
    conversationId: string | null;
    customerName: string | null;
    status: "success" | "error";
    message: string;
};

const MAX_EVENTS = 200;
const events: ActivityEvent[] = [];

export function recordActivity(
    event: Omit<ActivityEvent, "id" | "timestamp">
): void {
    const full: ActivityEvent = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        ...event,
    };

    events.push(full);

    if (events.length > MAX_EVENTS) {
        events.splice(0, events.length - MAX_EVENTS);
    }
}

/** Most recent first. */
export function getRecentActivity(limit = 50): ActivityEvent[] {
    return events.slice(-limit).reverse();
}
