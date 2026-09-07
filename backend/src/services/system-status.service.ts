export type ComponentState =
    | "healthy"
    | "processing"
    | "warning"
    | "error"
    | "offline"
    | "unknown";

export type ComponentStatus = {
    state: ComponentState;
    lastEventAt: string | null;
    lastError: string | null;
};

export type ComponentName = "whatsapp" | "gmail" | "ai" | "pipeline";

const statuses: Record<ComponentName, ComponentStatus> = {
    whatsapp: { state: "unknown", lastEventAt: null, lastError: null },
    gmail: { state: "unknown", lastEventAt: null, lastError: null },
    ai: { state: "unknown", lastEventAt: null, lastError: null },
    pipeline: { state: "unknown", lastEventAt: null, lastError: null },
};

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export function setComponentHealthy(name: ComponentName): void {
    statuses[name] = {
        state: "healthy",
        lastEventAt: new Date().toISOString(),
        lastError: null,
    };
}

export function setComponentError(name: ComponentName, error: unknown): void {
    statuses[name] = {
        state: "error",
        lastEventAt: new Date().toISOString(),
        lastError: errorMessage(error),
    };
}

export function setComponentOffline(name: ComponentName, reason?: string): void {
    statuses[name] = {
        state: "offline",
        lastEventAt: new Date().toISOString(),
        lastError: reason ?? null,
    };
}

export function getSystemStatus(): Record<ComponentName, ComponentStatus> {
    return statuses;
}
