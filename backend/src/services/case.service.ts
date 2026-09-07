import type { AIAnalysis } from "./ai.service";
import type { Channel } from "../types/communication";

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

const cases = new Map<string, ServiceCase>();

export function createServiceCase(
    conversationId: string,
    channel: Channel,
    customerName: string | null,
    analysis: AIAnalysis
): ServiceCase {
    const caseId = `CASE-${Date.now()}`;

    const serviceCase: ServiceCase = {
        id: caseId,
        conversationId,
        channel,
        waId:
            channel === "whatsapp"
                ? conversationId
                : null,
        customerName,
        intent: analysis.intent,
        equipment: analysis.equipment,
        problem: analysis.problem,
        location: analysis.location,
        request: analysis.request,
        summary: analysis.summary,
        status: "OPEN",
        createdAt: new Date().toISOString(),
    };

    cases.set(caseId, serviceCase);

    return serviceCase;
}

export function getServiceCase(
    caseId: string
): ServiceCase | null {
    return cases.get(caseId) ?? null;
}

export function getAllServiceCases(): ServiceCase[] {
    return Array.from(cases.values());
}