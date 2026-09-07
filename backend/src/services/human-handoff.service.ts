import { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";

export type HumanHandoffStatus =
    | "OPEN"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "RESOLVED"
    | "CLOSED";

export type HumanHandoff = {
    id: string;

    conversationId: string;
    channel: Channel;
    waId: string | null;
    customerName: string | null;

    intent: string | null;
    problem: string | null;
    request: string | null;

    reason: string | null;

    status: HumanHandoffStatus;
    assignedTo: string | null;

    createdAt: string;
};

const handoffs = new Map<string, HumanHandoff>();

export function createHumanHandoff(
    conversationId: string,
    channel: Channel,
    customerName: string | null,
    analysis: AIAnalysis
): HumanHandoff {
    const handoffId = `HANDOFF-${Date.now()}`;

    const handoff: HumanHandoff = {
        id: handoffId,

        conversationId,
        channel,
        waId: channel === "whatsapp" ? conversationId : null,
        customerName,

        intent: analysis.intent,
        problem: analysis.problem,
        request: analysis.request,

        reason: analysis.customer_position,

        status: "OPEN",
        assignedTo: null,

        createdAt: new Date().toISOString(),
    };

    handoffs.set(handoffId, handoff);

    return handoff;
}

export function getHumanHandoff(
    handoffId: string
): HumanHandoff | null {
    return handoffs.get(handoffId) ?? null;
}

export function getAllHumanHandoffs(): HumanHandoff[] {
    return Array.from(handoffs.values());
}