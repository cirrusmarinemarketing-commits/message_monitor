export type Channel =
    | "whatsapp"
    | "email";

export type NormalizedMessage = {
    channel: Channel;
    messageId: string;
    conversationId: string;
    sender: string;
    recipient?: string | null;
    subject?: string | null;
    text: string;
    timestamp: string;
    groupId?: string | null;
    senderName?: string | null;
};