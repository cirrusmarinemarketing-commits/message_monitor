import type { NormalizedMessage } from "../types/communication";
import { addConversationMessage, ConversationMessage } from "./conversation.service";
import { receiveMessage } from "./conversation.buffer.service";
import type { AIAnalysis } from "./ai.service";
import { recordActivity } from "./activity.service";

export type IngestOptions = {
    customerName?: string | null;
    waitForCompletion?: boolean;
    role?: string;
};

/**
 * The single shared entry point for both channels once a message has been
 * normalized by its adapter:
 * store conversation -> buffer/group -> AI analysis -> business logic ->
 * action executor -> case/handoff/response (the last four steps run inside
 * conversation.buffer.service once the debounce window elapses).
 */
export function ingestNormalizedMessage(
    normalized: NormalizedMessage,
    options: IngestOptions = {}
): Promise<AIAnalysis | null> | null {
    const customerName =
        options.customerName ??
        (normalized.channel === "email" ? normalized.sender : null);

    const message: ConversationMessage = {
        role: options.role ?? "customer",
        id: normalized.messageId,
        from: normalized.sender,
        to: normalized.recipient ?? null,
        timestamp: normalized.timestamp,
        type: normalized.channel === "email" ? "email" : "text",
        text: normalized.text,
        channel: normalized.channel,
        subject: normalized.subject ?? null,
        conversationId: normalized.conversationId,
        senderName: normalized.senderName ?? null,
    };

    const added = addConversationMessage(
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
        conversationId: normalized.conversationId,
        customerName,
        status: "success",
        message: `Message stored for ${normalized.conversationId}`,
    });

    return receiveMessage(
        {
            conversationId: normalized.conversationId,
            channel: normalized.channel,
            customerName,
        },
        message,
        options.waitForCompletion ?? false
    );
}
