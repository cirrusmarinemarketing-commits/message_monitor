import type { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";
import { pool } from "../database";

export type ConversationMessage = {
    role: "customer" | "cirrus";

    id?: string | null;
    from?: string | null;
    to?: string | null;

    timestamp?: string | null;
    type?: string | null;
    text?: string | null;

    channel?: Channel | null;
    subject?: string | null;

    conversationId?: string | null;
};

export type ConversationRecord = {
    conversationId: string;
    channel: Channel;
    customerName: string | null;
    messages: ConversationMessage[];
    updatedAt: string;
};

const MAX_MESSAGES = 30;

export async function addConversationMessage(
    conversationId: string,
    channel: Channel,
    message: ConversationMessage,
    customerName?: string | null
): Promise<boolean> {
    await pool.query(
        `
        INSERT INTO conversations (
            conversation_id,
            channel,
            customer_name
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (conversation_id, channel)
        DO UPDATE SET
            customer_name = COALESCE(
                conversations.customer_name,
                EXCLUDED.customer_name
            ),
            updated_at = NOW()
        `,
        [
            conversationId,
            channel,
            customerName ?? null,
        ]
    );

    const result = await pool.query(
        `
        INSERT INTO messages (
            conversation_id,
            channel,
            external_id,
            role,
            sender,
            recipient,
            message_type,
            text,
            subject,
            message_timestamp
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10
        )
        ON CONFLICT (channel, external_id)
        WHERE external_id IS NOT NULL
        DO NOTHING
        RETURNING id
        `,
        [
            conversationId,
            channel,
            message.id ?? null,
            message.role,
            message.from ?? null,
            message.to ?? null,
            message.type ?? null,
            message.text ?? null,
            message.subject ?? null,
            message.timestamp ?? null,
        ]
    );

    return result.rowCount === 1;
}

export async function getConversationHistory(
    conversationId: string,
    channel: Channel
): Promise<ConversationMessage[]> {
    const result = await pool.query(
        `
        SELECT
            external_id,
            role,
            sender,
            recipient,
            message_type,
            text,
            subject,
            message_timestamp
        FROM messages
        WHERE conversation_id = $1
          AND channel = $2
        ORDER BY
            COALESCE(message_timestamp, created_at) ASC,
            id ASC
        LIMIT $3
        `,
        [
            conversationId,
            channel,
            MAX_MESSAGES,
        ]
    );

    return result.rows.map((row) => ({
        role: row.role,
        id: row.external_id,
        from: row.sender,
        to: row.recipient,
        timestamp: row.message_timestamp
            ? new Date(row.message_timestamp).toISOString()
            : null,
        type: row.message_type,
        text: row.text,
        subject: row.subject,
        channel,
        conversationId,
    }));
}

export async function setConversationAnalysis(
    conversationId: string,
    channel: Channel,
    analysis: AIAnalysis
): Promise<void> {
    await pool.query(
        `
        INSERT INTO conversation_analyses (
            conversation_id,
            channel,
            intent,
            action,
            equipment,
            problem,
            location,
            request,
            amount,
            summary,
            customer_position,
            cirrus_position,
            pending_action,
            conversation_status,
            analyzed_at
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, NOW()
        )
        ON CONFLICT (conversation_id, channel)
        DO UPDATE SET
            intent = EXCLUDED.intent,
            action = EXCLUDED.action,
            equipment = EXCLUDED.equipment,
            problem = EXCLUDED.problem,
            location = EXCLUDED.location,
            request = EXCLUDED.request,
            amount = EXCLUDED.amount,
            summary = EXCLUDED.summary,
            customer_position = EXCLUDED.customer_position,
            cirrus_position = EXCLUDED.cirrus_position,
            pending_action = EXCLUDED.pending_action,
            conversation_status = EXCLUDED.conversation_status,
            analyzed_at = NOW()
        `,
        [
            conversationId,
            channel,
            analysis.intent ?? null,
            analysis.action ?? null,
            analysis.equipment ?? null,
            analysis.problem ?? null,
            analysis.location ?? null,
            analysis.request ?? null,
            analysis.amount ?? null,
            analysis.summary ?? null,
            analysis.customer_position ?? null,
            analysis.cirrus_position ?? null,
            analysis.pending_action ?? null,
            analysis.conversation_status ?? null,
        ]
    );
}

export async function getConversationAnalysis(
    conversationId: string,
    channel: Channel
): Promise<AIAnalysis | null> {
    const result = await pool.query(
        `
        SELECT
            intent,
            action,
            equipment,
            problem,
            location,
            request,
            amount,
            summary,
            customer_position,
            cirrus_position,
            pending_action,
            conversation_status
        FROM conversation_analyses
        WHERE conversation_id = $1
          AND channel = $2
        `,
        [
            conversationId,
            channel,
        ]
    );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0] as AIAnalysis;
}

export async function clearConversation(
    conversationId: string,
    channel: Channel
): Promise<void> {
    await pool.query(
        `
        DELETE FROM conversations
        WHERE conversation_id = $1
          AND channel = $2
        `,
        [
            conversationId,
            channel,
        ]
    );
}

export async function getAllConversations(): Promise<
    ConversationRecord[]
> {
    const result = await pool.query(
        `
        SELECT
            c.conversation_id,
            c.channel,
            c.customer_name,
            c.updated_at
        FROM conversations c
        ORDER BY c.updated_at DESC
        `
    );

    const conversations: ConversationRecord[] = [];

    for (const row of result.rows) {
        const messages = await getConversationHistory(
            row.conversation_id,
            row.channel
        );

        conversations.push({
            conversationId: row.conversation_id,
            channel: row.channel,
            customerName: row.customer_name,
            messages,
            updatedAt: new Date(row.updated_at).toISOString(),
        });
    }

    return conversations;
}