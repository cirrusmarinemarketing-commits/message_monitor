import {
    ConversationMessage,
    getConversationHistory,
    getConversationAnalysis,
    setConversationAnalysis,
} from "./conversation.service";
import { analyzeMessage, AIAnalysis } from "./ai.service";
import { processBusinessLogic } from "./business-logic.service";
import { executeBusinessAction } from "./action-executor.service";
import type { Channel } from "../types/communication";
import { recordActivity } from "./activity.service";
import {
    setComponentHealthy,
    setComponentError,
} from "./system-status.service";

export type ConversationIdentity = {
    conversationId: string;
    channel: Channel;
    customerName: string | null;
};

type CompletionWaiter = {
    resolve: (analysis: AIAnalysis) => void;
    reject: (error: unknown) => void;
};

type BufferState = {
    timer: NodeJS.Timeout | null;
    processing: boolean;
    version: number;
    messages: ConversationMessage[];
    waiters: CompletionWaiter[];
    identity: ConversationIdentity;
};

const buffers = new Map<string, BufferState>();

const DEBOUNCE_MS = 10000;

function getBuffer(
    identity: ConversationIdentity
): BufferState {
    let buffer = buffers.get(
        identity.conversationId
    );

    if (!buffer) {
        buffer = {
            timer: null,
            processing: false,
            version: 0,
            messages: [],
            waiters: [],
            identity,
        };

        buffers.set(
            identity.conversationId,
            buffer
        );
    } else {
        buffer.identity = identity;
    }

    return buffer;
}

export function receiveMessage(
    identity: ConversationIdentity,
    message: ConversationMessage,
    waitForCompletion = false
): Promise<AIAnalysis | null> | null {
    if (!identity.conversationId) {
        return null;
    }

    const buffer = getBuffer(identity);

    buffer.version++;
    buffer.messages.push(message);

    if (buffer.timer) {
        clearTimeout(buffer.timer);
    }

    let completionPromise:
        Promise<AIAnalysis | null> | null = null;

    if (waitForCompletion) {
        completionPromise =
            new Promise<AIAnalysis>(
                (resolve, reject) => {
                    buffer.waiters.push({
                        resolve,
                        reject,
                    });
                }
            );
    }

    buffer.timer = setTimeout(() => {
        processBuffer(identity);
    }, DEBOUNCE_MS);

    return completionPromise;
}

async function processBuffer(
    identity: ConversationIdentity
) {
    const buffer = getBuffer(identity);

    if (buffer.processing) return;
    if (buffer.messages.length === 0) return;

    buffer.processing = true;

    const processingVersion =
        buffer.version;

    const messages = [
        ...buffer.messages,
    ];

    buffer.messages = [];
    buffer.timer = null;

    try {
        console.log(
            "\n========== NEW CONVERSATION TURN =========="
        );

        console.log(
            "Channel:",
            identity.channel
        );

        console.log(
            "Customer:",
            identity.customerName ??
            "Unknown"
        );

        console.log(
            "Buffered Messages:",
            messages.length
        );

        for (const message of messages) {
            const role =
                message.role === "customer"
                    ? "CUSTOMER"
                    : "CIRRUS";

            console.log(
                `${role}: ${message.text ?? ""}`
            );
        }

        /*
         * Load the latest conversation history.
         *
         * This includes both CUSTOMER and CIRRUS
         * messages already stored in the database.
         */
        const history =
            await getConversationHistory(
                identity.conversationId,
                identity.channel
            );

        /*
         * Identify messages that belong to the
         * current buffered turn.
         */
        const turnMessageIds =
            new Set(
                messages
                    .map(
                        (message) =>
                            message.id
                    )
                    .filter(Boolean)
            );

        /*
         * Keep only previous messages from history.
         *
         * Current buffered messages will be added
         * separately so their individual roles are
         * preserved.
         */
        const previousHistory =
            history.filter(
                (message) =>
                    !message.id ||
                    !turnMessageIds.has(
                        message.id
                    )
            );

        /*
         * Load the latest AI analysis.
         *
         * This is context only. The real conversation
         * messages remain the source of truth.
         */
        const previousAnalysis =
            await getConversationAnalysis(
                identity.conversationId,
                identity.channel
            );

        console.log(
            "\n========== PREVIOUS AI ANALYSIS =========="
        );

        console.log(
            JSON.stringify(
                previousAnalysis,
                null,
                2
            )
        );

        /*
         * Build the complete conversation cluster:
         *
         * Previous history
         * +
         * Current buffered messages
         *
         * Each message keeps its original role.
         */
        const conversationCluster = [
            ...previousHistory,
            ...messages,
        ];

        const lastMessage =
            messages[
            messages.length - 1
            ];

        /*
         * The AI service expects currentMessage
         * as the trigger message.
         *
         * It is NOT used as the whole conversation.
         * The complete cluster is still provided through
         * conversationHistory.
         */
        const currentMessage =
            lastMessage ?? {
                role: "customer",
                id: null,
                from: null,
                to: null,
                timestamp: null,
                type: "text",
                text: null,
            };

        const analysis =
            await analyzeMessage({
                customer: {
                    profile: {
                        name:
                            identity.customerName,
                    },
                    wa_id:
                        identity.channel ===
                            "whatsapp"
                            ? identity.conversationId
                            : null,
                },

                currentMessage,

                conversationHistory:
                    conversationCluster,

                previousAnalysis,

                channel:
                    identity.channel,

                subject:
                    lastMessage?.subject ??
                    null,
            });

        setComponentHealthy("ai");

        recordActivity({
            channel:
                identity.channel,

            type:
                "ai_analysis_completed",

            conversationId:
                identity.conversationId,

            customerName:
                identity.customerName,

            status:
                "success",

            message:
                analysis.intent
                    ? `Intent: ${analysis.intent}`
                    : "Analysis completed",
        });

        const decision =
            processBusinessLogic(
                analysis
            );

        recordActivity({
            channel:
                identity.channel,

            type:
                "business_action_generated",

            conversationId:
                identity.conversationId,

            customerName:
                identity.customerName,

            status:
                "success",

            message:
                decision.action,
        });

        /*
         * If a new message arrived while AI was
         * processing, discard this result.
         *
         * The new message will be processed in
         * the next debounce cycle.
         */
        if (
            buffer.version !==
            processingVersion
        ) {
            console.log(
                "\n========== AI RESULT DISCARDED =========="
            );

            console.log(
                "New message arrived while AI was processing."
            );

            console.log(
                "Old AI result will not be used."
            );

            return;
        }

        /*
         * Save the latest AI state only after
         * confirming that no newer message arrived.
         */
        await setConversationAnalysis(
            identity.conversationId,
            identity.channel,
            analysis
        );

        console.log(
            "\n========== AI ANALYSIS =========="
        );

        console.log(
            JSON.stringify(
                analysis,
                null,
                2
            )
        );

        console.log(
            "\n========== BUSINESS DECISION =========="
        );

        console.log(
            JSON.stringify(
                decision,
                null,
                2
            )
        );

        const execution =
            executeBusinessAction(
                decision,
                analysis,
                {
                    conversationId:
                        identity.conversationId,

                    channel:
                        identity.channel,

                    name:
                        identity.customerName,
                }
            );

        console.log(
            "\n========== ACTION EXECUTION =========="
        );

        console.log(
            JSON.stringify(
                execution,
                null,
                2
            )
        );

        const executionEventType =
            decision.action ===
                "CREATE_CASE"
                ? "case_created"
                : decision.action ===
                    "HANDOFF_TO_HUMAN"
                    ? "handoff_created"
                    : decision.action ===
                        "RESPOND" ||
                        decision.action ===
                        "ASK_CLARIFICATION"
                        ? "response_generated"
                        : null;

        if (
            executionEventType
        ) {
            recordActivity({
                channel:
                    identity.channel,

                type:
                    executionEventType,

                conversationId:
                    identity.conversationId,

                customerName:
                    identity.customerName,

                status:
                    execution.success
                        ? "success"
                        : "error",

                message:
                    execution.message,
            });
        }

        setComponentHealthy(
            "pipeline"
        );

        const waiters = [
            ...buffer.waiters,
        ];

        buffer.waiters = [];

        for (
            const waiter of waiters
        ) {
            waiter.resolve(
                analysis
            );
        }
    } catch (error) {
        console.error(
            "Conversation processing error:",
            error
        );

        setComponentError(
            "ai",
            error
        );

        setComponentError(
            "pipeline",
            error
        );

        recordActivity({
            channel:
                identity.channel,

            type:
                "processing_error",

            conversationId:
                identity.conversationId,

            customerName:
                identity.customerName,

            status:
                "error",

            message:
                error instanceof Error
                    ? error.message
                    : String(error),
        });

        const waiters = [
            ...buffer.waiters,
        ];

        buffer.waiters = [];

        for (
            const waiter of waiters
        ) {
            waiter.reject(
                error
            );
        }
    } finally {
        buffer.processing = false;

        if (
            buffer.messages.length >
            0
        ) {
            buffer.timer =
                setTimeout(
                    () => {
                        processBuffer(
                            identity
                        );
                    },
                    DEBOUNCE_MS
                );
        }
    }
}

export function clearConversationBuffer(
    conversationId: string
) {
    const buffer =
        buffers.get(
            conversationId
        );

    if (!buffer) return;

    if (buffer.timer) {
        clearTimeout(
            buffer.timer
        );
    }

    const error =
        new Error(
            "Conversation buffer cleared"
        );

    for (
        const waiter of
        buffer.waiters
    ) {
        waiter.reject(
            error
        );
    }

    buffers.delete(
        conversationId
    );
}