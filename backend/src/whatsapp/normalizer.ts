import type { NormalizedMessage } from "../types/communication";

type WhatsAppMessageInput = {
    messageId: string;
    waId: string;
    from: string;
    text: string;
    timestamp: string;
    groupId?: string | null;
    senderName?: string | null;
};

export function normalizeWhatsAppMessage(
    input: WhatsAppMessageInput
): NormalizedMessage {
    return {
        channel: "whatsapp",
        messageId: input.messageId,
        conversationId: input.waId,
        sender: input.from,
        text: input.text,
        timestamp: new Date(Number(input.timestamp) * 1000).toISOString(),
        groupId: input.groupId ?? null,
        senderName: input.senderName ?? null,
    };
}