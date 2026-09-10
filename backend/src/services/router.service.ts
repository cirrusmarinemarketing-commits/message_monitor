import {
    getAllConversations,
    getConversationHistory,
    getConversationAnalysis,
} from "./conversation.service";

import {
    getAllServiceCases,
} from "./case.service";

import {
    getAllHumanHandoffs,
} from "./human-handoff.service";

import { getRecentActivity } from "./activity.service";
import { getSystemStatus } from "./system-status.service";

export async function getDashboardOverview() {
    const conversations = await getAllConversations();
    const cases = await getAllServiceCases();
    const handoffs = await getAllHumanHandoffs();

    let messageCount = 0;

    for (const conversation of conversations) {
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
        conversations: conversations.length,
        messages: messageCount,
        cases: cases.length,
        openCases: openCases.length,
        handoffs: handoffs.length,
        openHandoffs: openHandoffs.length,
    };
}

export async function getDashboardConversations() {
    const conversations = await getAllConversations();

    const result = [];

    for (const conversation of conversations) {
        const lastMessage =
            conversation.messages[
            conversation.messages.length - 1
            ] ?? null;

        const analysis = await getConversationAnalysis(
            conversation.conversationId,
            conversation.channel
        );

        result.push({
            channel: conversation.channel,

            conversationId:
                conversation.conversationId,

            customerName:
                conversation.customerName,

            groupId:
                conversation.groupId,

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
        });
    }

    return result;
}

export async function getDashboardConversation(
    conversationId: string,
    channel?: "whatsapp" | "email"
) {
    const conversations = await getAllConversations();

    const conversation = conversations.find(
        (item) =>
            item.conversationId === conversationId &&
            (!channel || item.channel === channel)
    );

    if (!conversation) {
        return null;
    }

    const analysis =
        await getConversationAnalysis(
            conversationId,
            conversation.channel
        );

    return {
        channel: conversation.channel,

        conversationId,

        customerName:
            conversation.customerName,

        groupId:
            conversation.groupId,

        messages:
            await getConversationHistory(
                conversationId,
                conversation.channel
            ),

        intent:
            analysis?.intent ?? null,

        summary:
            analysis?.summary ?? null,

        conversationStatus:
            analysis?.conversation_status ?? null,

        analysis,
    };
}

export async function getDashboardCases() {
    return await getAllServiceCases();
}

export async function getDashboardHandoffs() {
    return await getAllHumanHandoffs();
}

export function getDashboardActivity(limit?: number) {
    return getRecentActivity(limit);
}

export function getDashboardHealth() {
    return getSystemStatus();
}