import "dotenv/config";
import Groq from "groq-sdk";

const MODEL = "openai/gpt-oss-20b";
const MAX_RETRIES = 3;

export type AIAnalysis = {
    intent: string | null;
    action: string | null;
    equipment: string | null;
    problem: string | null;
    location: string | null;
    request: string | null;
    amount: number | null;
    summary: string | null;
    customer_position: string | null;
    cirrus_position: string | null;
    pending_action: string | null;
    conversation_status: string | null;
};

type CustomerInfo = {
    profile: {
        name?: string | null;
    } | null;
    wa_id: string | null;
};

type ConversationMessage = {
    role: "customer" | "cirrus";
    id?: string | null;
    from?: string | null;
    timestamp?: string | null;
    type?: string | null;
    text?: string | null;
};

type AnalyzeInput = {
    customer: CustomerInfo;
    currentMessage: ConversationMessage;
    conversationHistory: ConversationMessage[];
    previousAnalysis?: AIAnalysis | null;
    channel?: "whatsapp" | "email";
    subject?: string | null;
};

const SYSTEM_PROMPT = `
You are Cirrus Marine's conversation analysis engine.

Analyze the FULL conversation cluster, including both CUSTOMER and CIRRUS messages.

The latest message triggers the analysis, but must NOT be analyzed alone.

The conversation messages are the PRIMARY SOURCE OF TRUTH.

A previous AI analysis may be provided as context.
It is NOT the source of truth.
Always validate it against the current conversation.
If the previous analysis is outdated or contradicted by the conversation, correct it.

Determine the CURRENT state of the conversation, not merely the previous state.

Rules:
- Use only facts stated in the conversation.
- Never invent facts, prices, dates, actions, or confirmations.
- Unknown information = null.
- Preserve the meaning of the conversation.
- For email, use the subject as context.
- Keep CUSTOMER and CIRRUS positions separate.
- pending_action must describe what is currently expected to happen next.
- conversation_status must describe the current state after considering the whole conversation.

INTENT:
quotation_request, service_request, technical_support, parts_inquiry,
payment_inquiry, refund_request, follow_up, complaint,
general_inquiry, needs_clarification, normal_chat.

SERVICE:
- Asking if Cirrus provides a service → service_request + RESPOND.
- Reporting a real problem or requesting service/repair → service_request + CREATE_CASE.
- Vague request without a meaningful problem → needs_clarification + ASK_CLARIFICATION.

HANDOFF:
If the customer explicitly asks for a human/staff member:
→ action = HANDOFF_TO_HUMAN
Keep the underlying intent.

FOLLOW-UP:
If asking for an update on an existing request:
→ intent = follow_up
→ action = RESPOND.

ACTION:
CREATE_CASE, HANDOFF_TO_HUMAN, ASK_CLARIFICATION, RESPOND, NO_ACTION.

STATUS:
Return the current conversation status based on the whole conversation.

AMOUNT:
Return only the single monetary amount directly relevant to the customer's current request.
If amounts are only background information, return null.
If multiple amounts are mentioned without one clearly being the requested amount, return null.

Return exactly:
{
  "intent": string | null,
  "action": string | null,
  "equipment": string | null,
  "problem": string | null,
  "location": string | null,
  "request": string | null,
  "amount": number | null,
  "summary": string | null,
  "customer_position": string | null,
  "cirrus_position": string | null,
  "pending_action": string | null,
  "conversation_status": string | null
}

JSON only. No markdown. No explanation.
`;

function getGroqClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing or empty");
    }

    return new Groq({ apiKey });
}

function buildUserPrompt(input: AnalyzeInput): string {
    const history = [...input.conversationHistory];

    const currentExists = input.currentMessage.id
        ? history.some(
            (message) =>
                message.id === input.currentMessage.id
        )
        : history.length > 0 &&
        history[history.length - 1]?.text ===
        input.currentMessage.text;

    if (!currentExists) {
        history.push(input.currentMessage);
    }

    const conversation = history
        .map((message, index) => {
            const role =
                message.role === "customer"
                    ? "CUSTOMER"
                    : "CIRRUS";

            return `${index + 1}. ${role}: ${message.text ?? ""}`;
        })
        .join("\n");

    const previousAnalysis = input.previousAnalysis
        ? JSON.stringify(
            input.previousAnalysis,
            null,
            2
        )
        : "(none - this is the first analysis)";

    return `
Channel: ${input.channel ?? "whatsapp"}
Customer: ${input.customer.profile?.name ?? "Unknown"}
Subject: ${input.subject ?? "(none)"}

PREVIOUS AI ANALYSIS:
${previousAnalysis}

CONVERSATION CLUSTER:
${conversation || "(none)"}

IMPORTANT:
The previous AI analysis is only a reference.
Use the conversation cluster as the source of truth.
If the conversation has changed since the previous analysis,
return the NEW CURRENT state.

Analyze the entire conversation cluster.
Return JSON only.
`;
}

function parseDuration(
    value: string | null | undefined
): number {
    if (!value) return 0;

    const match = value.match(
        /(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?\s*(?:(\d+(?:\.\d+)?)s)?/
    );

    if (!match) return 0;

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);

    return (
        (hours * 3600 +
            minutes * 60 +
            seconds) *
        1000
    );
}

function getRetryDelay(error: any): number {
    const headers = error?.headers;

    const retryAfter =
        headers?.get?.("retry-after");

    const resetTokens =
        headers?.get?.("x-ratelimit-reset-tokens");

    const retryAfterMs = retryAfter
        ? Number(retryAfter) * 1000
        : 0;

    const resetTokensMs =
        parseDuration(resetTokens);

    return (
        Math.max(
            retryAfterMs,
            resetTokensMs,
            3000
        ) + 500
    );
}

function isRateLimitError(error: any): boolean {
    return (
        error?.status === 429 ||
        error?.statusCode === 429
    );
}

function cleanJsonContent(content: string): string {
    return content
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

export async function analyzeMessage(
    input: AnalyzeInput
): Promise<AIAnalysis> {
    const groq = getGroqClient();
    const userPrompt = buildUserPrompt(input);

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            console.log(
                "Sending conversation cluster to Groq..."
            );

            const completion =
                await groq.chat.completions.create({
                    model: MODEL,
                    temperature: 0,
                    response_format: {
                        type: "json_object",
                    },
                    messages: [
                        {
                            role: "system",
                            content: SYSTEM_PROMPT,
                        },
                        {
                            role: "user",
                            content: userPrompt,
                        },
                    ],
                });

            const rawContent =
                completion.choices[0]
                    ?.message?.content;

            if (!rawContent) {
                throw new Error(
                    "Groq returned an empty response"
                );
            }

            const analysis = JSON.parse(
                cleanJsonContent(rawContent)
            ) as AIAnalysis;

            return {
                intent: analysis.intent ?? null,
                action: analysis.action ?? null,
                equipment: analysis.equipment ?? null,
                problem: analysis.problem ?? null,
                location: analysis.location ?? null,
                request: analysis.request ?? null,
                amount:
                    typeof analysis.amount === "number"
                        ? analysis.amount
                        : null,
                summary: analysis.summary ?? null,
                customer_position:
                    analysis.customer_position ?? null,
                cirrus_position:
                    analysis.cirrus_position ?? null,
                pending_action:
                    analysis.pending_action ?? null,
                conversation_status:
                    analysis.conversation_status ?? null,
            };
        } catch (error: any) {
            const errorCode =
                error?.error?.error?.code ??
                error?.code;

            if (
                errorCode ===
                "json_validate_failed"
            ) {
                console.warn(
                    `Groq JSON validation failed. Retry ${attempt}/${MAX_RETRIES}`
                );

                if (
                    attempt >= MAX_RETRIES
                ) {
                    throw error;
                }

                await new Promise((resolve) =>
                    setTimeout(resolve, 1000)
                );

                continue;
            }

            if (!isRateLimitError(error)) {
                console.error(
                    "Groq analysis error:",
                    error
                );

                throw error;
            }

            if (attempt >= MAX_RETRIES) {
                console.error(
                    "Groq rate limit: maximum retries reached"
                );

                throw error;
            }

            const delay = getRetryDelay(error);

            console.warn(
                `Groq rate limit reached. Retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(
                    delay / 1000
                )}s`
            );

            await new Promise((resolve) =>
                setTimeout(resolve, delay)
            );
        }
    }

    throw new Error("AI analysis failed");
}
