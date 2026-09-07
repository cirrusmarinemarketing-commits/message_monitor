import type { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";

export type ConversationMessage = {
    role: "customer" | "cirrus";

    id?: string | null;
    from?: string | null;
    to?: string | null;

    timestamp?: string | null;
    type?: string | null;
    text?: string | null;

    // Communication source
    channel?: Channel | null;

    // Email-specific
    subject?: string | null;

    // Conversation identifier
    conversationId?: string | null;
};

export type ConversationRecord = {
    conversationId: string;
    channel: Channel;
    customerName: string | null;
    messages: ConversationMessage[];
    updatedAt: string;
};

const conversations = new Map<string, ConversationRecord>();

const analyses = new Map<string, AIAnalysis>();

const MAX_MESSAGES = 30;

function getOrCreateConversation(
    conversationId: string,
    channel: Channel,
    customerName?: string | null
): ConversationRecord {
    let record = conversations.get(conversationId);

    if (!record) {
        record = {
            conversationId,
            channel,
            customerName: customerName ?? null,
            messages: [],
            updatedAt: new Date().toISOString(),
        };

        conversations.set(conversationId, record);
    } else if (customerName && !record.customerName) {
        record.customerName = customerName;
    }

    return record;
}

/**
 * Returns false when the message id was already stored for this
 * conversation, so callers can skip re-triggering downstream processing.
 */
export function addConversationMessage(
    conversationId: string,
    channel: Channel,
    message: ConversationMessage,
    customerName?: string | null
): boolean {
    const record = getOrCreateConversation(
        conversationId,
        channel,
        customerName
    );

    if (
        message.id &&
        record.messages.some((existing) => existing.id === message.id)
    ) {
        return false;
    }

    record.messages.push(message);

    if (record.messages.length > MAX_MESSAGES) {
        record.messages.splice(
            0,
            record.messages.length - MAX_MESSAGES
        );
    }

    record.updatedAt = new Date().toISOString();

    return true;
}

export function getConversationHistory(
    conversationId: string
): ConversationMessage[] {
    return conversations.get(conversationId)?.messages ?? [];
}

export function setConversationAnalysis(
    conversationId: string,
    analysis: AIAnalysis
) {
    analyses.set(conversationId, analysis);
}

export function getConversationAnalysis(
    conversationId: string
): AIAnalysis | null {
    return analyses.get(conversationId) ?? null;
}

export function clearConversation(conversationId: string) {
    conversations.delete(conversationId);
    analyses.delete(conversationId);
}

export function getAllConversations(): Map<string, ConversationRecord> {
    return conversations;
}

export function getAllConversationAnalyses(): Map<string, AIAnalysis> {
    return analyses;
}
