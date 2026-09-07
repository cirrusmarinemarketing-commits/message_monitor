import {
    getAllConversations,
    getConversationHistory,
    getAllConversationAnalyses,
} from "./conversation.service";

import {
    getAllServiceCases,
} from "./case.service";

import {
    getAllHumanHandoffs,
} from "./human-handoff.service";

import { getRecentActivity } from "./activity.service";
import { getSystemStatus } from "./system-status.service";

export function getDashboardOverview() {
    const conversations = getAllConversations();
    const cases = getAllServiceCases();
    const handoffs = getAllHumanHandoffs();

    let messageCount = 0;

    for (const conversation of conversations.values()) {
        messageCount += conversation.messages.length;
    }

    const openCases = cases.filter(
        (item) =>
            item.status === "OPEN" ||
            item.status === "PENDING" ||
            item.status === "IN_PROGRESS"
    );

    const openHandoffs = handoffs.filter(
        (item) =>
            item.status === "OPEN" ||
            item.status === "ASSIGNED" ||
            item.status === "IN_PROGRESS"
    );

    return {
        conversations: conversations.size,
        messages: messageCount,
        cases: cases.length,
        openCases: openCases.length,
        handoffs: handoffs.length,
        openHandoffs: openHandoffs.length,
    };
}

export function getDashboardConversations() {
    const conversations = getAllConversations();
    const analyses = getAllConversationAnalyses();

    return Array.from(conversations.entries()).map(
        ([conversationId, conversation]) => {
            const lastMessage =
                conversation.messages[
                conversation.messages.length - 1
                ] ?? null;

            const analysis =
                analyses.get(conversationId) ?? null;

            return {
                channel: conversation.channel,

                conversationId,

                customerName: conversation.customerName,

                messageCount:
                    conversation.messages.length,

                lastMessage,

                intent:
                    analysis?.intent ?? null,

                summary:
                    analysis?.summary ?? null,

                conversationStatus:
                    analysis?.conversation_status ?? null,

                action:
                    analysis?.action ?? null,
            };
        }
    );
}

export function getDashboardConversation(
    conversationId: string
) {
    const conversation =
        getAllConversations().get(conversationId);

    if (!conversation) {
        return null;
    }

    const analysis =
        getAllConversationAnalyses().get(conversationId) ?? null;

    return {
        channel: conversation.channel,
        conversationId,
        customerName: conversation.customerName,
        messages: getConversationHistory(
            conversationId
        ),
        intent: analysis?.intent ?? null,
        summary: analysis?.summary ?? null,
        conversationStatus: analysis?.conversation_status ?? null,
        analysis,
    };
}

export function getDashboardCases() {
    return getAllServiceCases();
}

export function getDashboardHandoffs() {
    return getAllHumanHandoffs();
}

export function getDashboardActivity(limit?: number) {
    return getRecentActivity(limit);
}

export function getDashboardHealth() {
    return getSystemStatus();
}
