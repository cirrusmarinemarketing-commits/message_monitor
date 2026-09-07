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
    amount: string | null;
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

    channel?: "whatsapp" | "email";
    subject?: string | null;
};

const SYSTEM_PROMPT = `
You are Cirrus Marine's conversation analysis engine.

Analyze the customer's latest active request using the conversation context.

RULES:
- Focus on the latest active customer intent.
- Use previous messages only as context.
- Never invent facts, dates, prices, availability, actions, or confirmations.
- Extract only information explicitly stated.
- If information is unknown, return null.
- Preserve the customer's wording and meaning when extracting facts.
- Support both WhatsApp and Email.
- For Email, use the subject as additional context.

INTENT:
- quotation_request: asks for quotation, estimate, or price for a service/product.
- service_request: wants inspection, repair, installation, maintenance, or other physical service.
- technical_support: mainly wants technical advice or troubleshooting.
- parts_inquiry: asks about spare parts, stock, or part pricing.
- payment_inquiry: payment, invoice, billing, or amount issue.
- refund_request: explicitly asks for a refund.
- follow_up: asks for an update on an existing request.
- complaint: expresses dissatisfaction or complaint.
- general_inquiry: clear general business question.
- needs_clarification: request is too vague to process.
- normal_chat: casual conversation.

SERVICE:
- Asking whether Cirrus provides a service → service_request + RESPOND.
- Reporting a real problem or requesting technician/service → service_request + CREATE_CASE.
- Missing optional details such as location/model does not prevent CREATE_CASE.
- A vague request without a meaningful problem → needs_clarification.

HANDOFF:
If the customer asks to speak with a person/staff/member of the team:
→ action = HANDOFF_TO_HUMAN
Keep the underlying intent.

FOLLOW-UP:
If asking for an update on an existing request:
→ intent = follow_up
→ action = RESPOND
→ status = waiting_for_cirrus

ACTION:
- CREATE_CASE = meaningful service/repair request.
- HANDOFF_TO_HUMAN = explicitly requests a human.
- ASK_CLARIFICATION = request is too vague.
- RESPOND = normal inquiry/request that can be answered.
- NO_ACTION = casual conversation.

STATUS:
Use the most appropriate status based only on the conversation.

OUTPUT:
Return exactly one JSON object with these fields:
{
  "intent": string | null,
  "action": string | null,
  "equipment": string | null,
  "problem": string | null,
  "location": string | null,
  "request": string | null,
  "amount": string | null,
  "summary": string | null,
  "customer_position": string | null,
  "cirrus_position": string | null,
  "pending_action": string | null,
  "conversation_status": string | null
}

No markdown. No explanation. JSON only.
`;

function getGroqClient(): Groq {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing or empty");
    }

    return new Groq({ apiKey });
}

function buildUserPrompt(input: AnalyzeInput): string {
    const history = input.conversationHistory
        .slice(-10)
        .map((message) => {
            const role =
                message.role === "customer"
                    ? "CUSTOMER"
                    : "CIRRUS";

            return `${role}: ${message.text ?? ""}`;
        })
        .join("\n");

    return `
Channel: ${input.channel ?? "whatsapp"}
Customer: ${input.customer.profile?.name ?? "Unknown"}
Subject: ${input.subject ?? "(none)"}

Conversation:
${history || "(none)"}

Latest customer message:
${input.currentMessage.text ?? ""}

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

function cleanJsonContent(
    content: string
): string {
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

    const userPrompt =
        buildUserPrompt(input);

    for (
        let attempt = 1;
        attempt <= MAX_RETRIES;
        attempt++
    ) {
        try {
            console.log(
                "Sending conversation to Groq..."
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

            const content =
                cleanJsonContent(rawContent);

            const analysis =
                JSON.parse(content) as AIAnalysis;

            return {
                intent:
                    analysis.intent ?? null,

                action:
                    analysis.action ?? null,

                equipment:
                    analysis.equipment ?? null,

                problem:
                    analysis.problem ?? null,

                location:
                    analysis.location ?? null,

                request:
                    analysis.request ?? null,

                amount:
                    analysis.amount ?? null,

                summary:
                    analysis.summary ?? null,

                customer_position:
                    analysis.customer_position ??
                    null,

                cirrus_position:
                    analysis.cirrus_position ??
                    null,

                pending_action:
                    analysis.pending_action ??
                    null,

                conversation_status:
                    analysis.conversation_status ??
                    null,
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
                    console.error(
                        "Groq JSON validation: maximum retries reached"
                    );

                    throw error;
                }

                await new Promise(
                    (resolve) =>
                        setTimeout(resolve, 1000)
                );

                continue;
            }

            if (
                !isRateLimitError(error)
            ) {
                console.error(
                    "Groq analysis error:",
                    error
                );

                throw error;
            }

            if (
                attempt >= MAX_RETRIES
            ) {
                console.error(
                    "Groq rate limit: maximum retries reached"
                );

                throw error;
            }

            const delay =
                getRetryDelay(error);

            console.warn(
                `Groq rate limit reached. Retry ${attempt}/${MAX_RETRIES - 1} after ${Math.round(
                    delay / 1000
                )}s`
            );

            await new Promise(
                (resolve) =>
                    setTimeout(resolve, delay)
            );
        }
    }

    throw new Error(
        "AI analysis failed"
    );
}