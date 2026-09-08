import type { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";
import { query } from "../database";

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

export async function addConversationMessage(
    conversationId: string,
    channel: Channel,
    message: ConversationMessage,
    customerName?: string | null
): Promise<boolean> {

    await query(
        `
        INSERT INTO conversations (
            conversation_id,
            channel,
            customer_name,
            updated_at
        )
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (conversation_id, channel)
        DO UPDATE SET
            customer_name =
                COALESCE(conversations.customer_name, EXCLUDED.customer_name),
            updated_at = NOW()
        `,
        [
            conversationId,
            channel,
            customerName ?? null,
        ]
    );

    if (message.id) {
        const duplicate = await query(
            `
            SELECT id
            FROM messages
            WHERE channel = $1
              AND external_id = $2
            LIMIT 1
            `,
            [channel, message.id]
        );

        if (duplicate.rowCount && duplicate.rowCount > 0) {
            return false;
        }
    }

    await query(
        `
        INSERT INTO messages (
            conversation_id,
            channel,
            external_id,
            role,
            sender_from,
            sender_to,
            message_timestamp,
            message_type,
            text,
            subject
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10
        )
        `,
        [
            conversationId,
            channel,
            message.id ?? null,
            message.role,
            message.from ?? null,
            message.to ?? null,
            message.timestamp ?? null,
            message.type ?? null,
            message.text ?? null,
            message.subject ?? null,
        ]
    );

    return true;
}

export async function getConversationHistory(
    conversationId: string,
    channel?: Channel
): Promise<ConversationMessage[]> {

    const result = channel
        ? await query(
            `
            SELECT
                role,
                external_id,
                sender_from,
                sender_to,
                message_timestamp,
                message_type,
                text,
                subject
            FROM messages
            WHERE conversation_id = $1
              AND channel = $2
            ORDER BY message_timestamp ASC NULLS LAST, id ASC
            `,
            [conversationId, channel]
        )
        : await query(
            `
            SELECT
                role,
                external_id,
                sender_from,
                sender_to,
                message_timestamp,
                message_type,
                text,
                subject
            FROM messages
            WHERE conversation_id = $1
            ORDER BY message_timestamp ASC NULLS LAST, id ASC
            `,
            [conversationId]
        );

    return result.rows.map((row) => ({
        role: row.role,
        id: row.external_id,
        from: row.sender_from,
        to: row.sender_to,
        timestamp: row.message_timestamp,
        type: row.message_type,
        text: row.text,
        subject: row.subject,
        conversationId,
        channel: channel ?? null,
    }));
}

export async function setConversationAnalysis(
    conversationId: string,
    channel: Channel,
    analysis: AIAnalysis
): Promise<void> {

    await query(
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
            conversation_status
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,
            $8,$9,$10,$11,$12,$13,$14
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
            created_at = NOW()
        `,
        [
            conversationId,
            channel,
            analysis.intent,
            analysis.action,
            analysis.equipment,
            analysis.problem,
            analysis.location,
            analysis.request,
            analysis.amount,
            analysis.summary,
            analysis.customer_position,
            analysis.cirrus_position,
            analysis.pending_action,
            analysis.conversation_status,
        ]
    );
}

export async function getConversationAnalysis(
    conversationId: string,
    channel: Channel
): Promise<AIAnalysis | null> {

    const result = await query(
        `
        SELECT *
        FROM conversation_analyses
        WHERE conversation_id = $1
          AND channel = $2
        LIMIT 1
        `,
        [conversationId, channel]
    );

    if (!result.rowCount) {
        return null;
    }

    const row = result.rows[0];

    return {
        intent: row.intent,
        action: row.action,
        equipment: row.equipment,
        problem: row.problem,
        location: row.location,
        request: row.request,
        amount: row.amount,
        summary: row.summary,
        customer_position: row.customer_position,
        cirrus_position: row.cirrus_position,
        pending_action: row.pending_action,
        conversation_status: row.conversation_status,
    };
}

export async function getAllConversations(): Promise<
    Map<string, ConversationRecord>
> {
    const conversationsResult = await query(
        `
        SELECT
            conversation_id,
            channel,
            customer_name,
            updated_at
        FROM conversations
        ORDER BY updated_at DESC
        `
    );

    const result = new Map<string, ConversationRecord>();

    for (const row of conversationsResult.rows) {
        const messages = await getConversationHistory(
            row.conversation_id,
            row.channel
        );

        result.set(
            `${row.conversation_id}:${row.channel}`,
            {
                conversationId: row.conversation_id,
                channel: row.channel,
                customerName: row.customer_name,
                messages,
                updatedAt: row.updated_at,
            }
        );
    }

    return result;
}