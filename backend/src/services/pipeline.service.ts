import type { NormalizedMessage } from "../types/communication";

import {
    addConversationMessage,
    ConversationMessage,
} from "./conversation.service";

import { receiveMessage } from "./conversation.buffer.service";

import type { AIAnalysis } from "./ai.service";

import { recordActivity } from "./activity.service";

export type IngestOptions = {
    customerName?: string | null;
    waitForCompletion?: boolean;
    role?: "customer" | "cirrus";
};

export async function ingestNormalizedMessage(
    normalized: NormalizedMessage,
    options: IngestOptions = {}
): Promise<AIAnalysis | null> {
    const customerName =
        options.customerName ??
        (normalized.channel === "email"
            ? normalized.sender
            : null);

    /*
     * Role MUST already be determined by the
     * channel adapter before this point.
     *
     * WhatsApp:
     *   staff    → cirrus
     *   customer → customer
     *
     * Email:
     *   currently defaults to customer unless
     *   the caller explicitly provides another role.
     */
    const role =
        options.role ?? "customer";

    const message: ConversationMessage = {
        role,

        id: normalized.messageId,

        from: normalized.sender,

        to: normalized.recipient ?? null,

        timestamp: normalized.timestamp,

        type:
            normalized.channel === "email"
                ? "email"
                : "text",

        text: normalized.text,

        channel: normalized.channel,

        subject:
            normalized.subject ?? null,

        conversationId:
            normalized.conversationId,

        senderName:
            normalized.senderName ?? null,
    };

    /*
     * IMPORTANT:
     *
     * Wait for PostgreSQL INSERT before
     * continuing into the conversation pipeline.
     *
     * This makes duplicate detection reliable
     * and guarantees the role is persisted.
     */
    const added =
        await addConversationMessage(
            normalized.conversationId,
            normalized.channel,
            message,
            customerName,
            normalized.groupId ?? null
        );

    if (!added) {
        console.log(
            `Duplicate message ignored (idempotent): ${normalized.channel}/${normalized.messageId}`
        );

        return null;
    }

    recordActivity({
        channel: normalized.channel,

        type: "conversation_updated",

        conversationId:
            normalized.conversationId,

        customerName,

        status: "success",

        message:
            `Message stored for ${normalized.conversationId} as ${role}`,
    });

    /*
     * Only process the conversation after
     * the message has successfully been stored.
     */
    return receiveMessage(
        {
            conversationId:
                normalized.conversationId,

            channel: normalized.channel,

            customerName,
        },
        message,
        options.waitForCompletion ?? false
    );
}