import type {
    NormalizedMessage,
} from "../types/communication";

type GmailEmailInput = {
    messageId: string;
    threadId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
};

export function normalizeGmailMessage(
    email: GmailEmailInput
): NormalizedMessage {
    return {
        channel: "email",
        messageId:
            email.messageId,
        conversationId:
            email.threadId,
        sender:
            email.from,
        recipient:
            email.to,
        subject:
            email.subject,
        text:
            email.body,
        timestamp:
            email.timestamp,
    };
}