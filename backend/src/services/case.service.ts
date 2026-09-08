import type { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";
import { pool } from "../database";

export type ServiceCaseStatus =
    | "OPEN"
    | "PENDING"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED";

export type ServiceCase = {
    id: string;
    conversationId: string;
    channel: Channel;
    waId: string | null;
    customerName: string | null;
    intent: string | null;
    equipment: string | null;
    problem: string | null;
    location: string | null;
    request: string | null;
    summary: string | null;
    status: ServiceCaseStatus;
    createdAt: string;
};

export async function createServiceCase(
    conversationId: string,
    channel: Channel,
    customerName: string | null,
    analysis: AIAnalysis
): Promise<ServiceCase> {
    const caseId = `CASE-${Date.now()}`;

    const result = await pool.query(
        `
        INSERT INTO service_cases (
            id,
            conversation_id,
            channel,
            wa_id,
            customer_name,
            intent,
            equipment,
            problem,
            location,
            request,
            summary,
            status
        )
        VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, 'OPEN'
        )
        RETURNING
            id,
            conversation_id,
            channel,
            wa_id,
            customer_name,
            intent,
            equipment,
            problem,
            location,
            request,
            summary,
            status,
            created_at
        `,
        [
            caseId,
            conversationId,
            channel,
            channel === "whatsapp"
                ? conversationId
                : null,
            customerName,
            analysis.intent ?? null,
            analysis.equipment ?? null,
            analysis.problem ?? null,
            analysis.location ?? null,
            analysis.request ?? null,
            analysis.summary ?? null,
        ]
    );

    const row = result.rows[0];

    return {
        id: row.id,
        conversationId: row.conversation_id,
        channel: row.channel,
        waId: row.wa_id,
        customerName: row.customer_name,
        intent: row.intent,
        equipment: row.equipment,
        problem: row.problem,
        location: row.location,
        request: row.request,
        summary: row.summary,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
    };
}

export async function getServiceCase(
    caseId: string
): Promise<ServiceCase | null> {
    const result = await pool.query(
        `
        SELECT
            id,
            conversation_id,
            channel,
            wa_id,
            customer_name,
            intent,
            equipment,
            problem,
            location,
            request,
            summary,
            status,
            created_at
        FROM service_cases
        WHERE id = $1
        `,
        [caseId]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const row = result.rows[0];

    return {
        id: row.id,
        conversationId: row.conversation_id,
        channel: row.channel,
        waId: row.wa_id,
        customerName: row.customer_name,
        intent: row.intent,
        equipment: row.equipment,
        problem: row.problem,
        location: row.location,
        request: row.request,
        summary: row.summary,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
    };
}

export async function getAllServiceCases(): Promise<ServiceCase[]> {
    const result = await pool.query(
        `
        SELECT
            id,
            conversation_id,
            channel,
            wa_id,
            customer_name,
            intent,
            equipment,
            problem,
            location,
            request,
            summary,
            status,
            created_at
        FROM service_cases
        ORDER BY created_at DESC
        `
    );

    return result.rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        channel: row.channel,
        waId: row.wa_id,
        customerName: row.customer_name,
        intent: row.intent,
        equipment: row.equipment,
        problem: row.problem,
        location: row.location,
        request: row.request,
        summary: row.summary,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
    }));
}