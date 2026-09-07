import type { NormalizedMessage } from "../types/communication";

type WhatsAppMessageInput = {
    messageId: string;
    waId: string;
    from: string;
    text: string;
    timestamp: string;
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
        timestamp: input.timestamp,
    };
}
