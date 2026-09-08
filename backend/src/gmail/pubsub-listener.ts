import {
    PubSub,
    Message,
} from "@google-cloud/pubsub";

import {
    processGmailHistory,
} from "./processor";

import {
    setComponentHealthy,
    setComponentError,
    setComponentOffline,
} from "../services/system-status.service";

const PROJECT_ID =
    "vivid-kite-458204-h8";

const SUBSCRIPTION_NAME =
    "gmail-notifications-sub";

// Simple in-process queue.
// Gmail notifications are processed one at a time.
let processingQueue: Promise<void> =
    Promise.resolve();

function getErrorStatus(
    error: any
): number | null {
    return (
        error?.response?.status ??
        error?.status ??
        error?.code ??
        null
    );
}

function isPermanentError(
    error: any
): boolean {
    const status =
        getErrorStatus(error);

    // 400 / 401 / 403 / 404 are generally
    // not fixed by immediately retrying
    // the exact same Pub/Sub notification.
    return (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        status === 404
    );
}

function enqueue(
    message: Message,
    task: () => Promise<void>
) {
    processingQueue =
        processingQueue
            .then(async () => {
                try {
                    await task();

                    message.ack();

                    setComponentHealthy(
                        "gmail"
                    );

                    console.log(
                        "✓ Pub/Sub message acknowledged"
                    );
                    console.log("");
                } catch (error) {
                    console.error("");
                    console.error(
                        "Gmail processing failed:"
                    );
                    console.error(error);
                    console.error("");

                    setComponentError(
                        "gmail",
                        error
                    );

                    const status =
                        getErrorStatus(
                            error
                        );

                    console.error(
                        `Gmail error status: ${status ?? "unknown"
                        }`
                    );

                    /*
                     * Permanent errors:
                     *
                     * Do not continuously retry the same
                     * notification if the error is known
                     * to be non-recoverable.
                     *
                     * The processor already handles
                     * individual message 404s itself.
                     */
                    if (
                        isPermanentError(
                            error
                        )
                    ) {
                        console.error(
                            "Permanent Gmail error. Acknowledging Pub/Sub message."
                        );

                        message.ack();

                        console.log(
                            "✓ Pub/Sub message acknowledged after permanent error"
                        );

                        return;
                    }

                    /*
                     * Temporary errors:
                     *
                     * Keep the message for retry.
                     *
                     * Pub/Sub will redeliver it according
                     * to the subscription retry policy.
                     */
                    console.error(
                        "Temporary Gmail error. Requesting Pub/Sub retry."
                    );

                    message.nack();

                    console.log(
                        "↻ Pub/Sub message nacked for retry"
                    );
                }
            })
            .catch((error) => {
                /*
                 * The queue itself should never stop
                 * because of an unexpected error.
                 */
                console.error("");
                console.error(
                    "Queue error:"
                );
                console.error(error);
                console.error("");
            });
}

/**
 * Starts the Gmail Pub/Sub listener in the
 * current process.
 *
 * This runs together with Express so Gmail,
 * PostgreSQL, dashboard and the shared pipeline
 * all operate inside the same application process.
 */
export function startGmailPubSubListener(): void {
    try {
        console.log(
            "Starting Gmail Pub/Sub processor..."
        );

        const pubsub =
            new PubSub({
                projectId:
                    PROJECT_ID,
            });

        const subscription =
            pubsub.subscription(
                SUBSCRIPTION_NAME
            );

        console.log("");
        console.log(
            `✓ Project: ${PROJECT_ID}`
        );
        console.log(
            `✓ Subscription: ${SUBSCRIPTION_NAME}`
        );
        console.log("");
        console.log(
            "Listening for Gmail notifications..."
        );
        console.log("");

        setComponentHealthy(
            "gmail"
        );

        subscription.on(
            "message",
            (message) => {
                enqueue(
                    message,
                    async () => {
                        console.log(
                            "========================================"
                        );
                        console.log(
                            "GMAIL NOTIFICATION RECEIVED"
                        );
                        console.log(
                            "========================================"
                        );

                        console.log(
                            `Pub/Sub Message ID: ${message.id}`
                        );

                        console.log(
                            `Data: ${message.data.toString()}`
                        );

                        let notification: {
                            emailAddress?: string;
                            historyId?: string;
                        };

                        try {
                            notification =
                                JSON.parse(
                                    message.data.toString()
                                );
                        } catch (error) {
                            console.error(
                                "Invalid Pub/Sub message JSON."
                            );

                            throw new Error(
                                "Invalid Gmail Pub/Sub notification JSON"
                            );
                        }

                        const historyId =
                            notification.historyId;

                        if (!historyId) {
                            console.log(
                                "⚠ No historyId found"
                            );

                            // Nothing useful to process.
                            // Return normally so the message
                            // is ACKed.
                            return;
                        }

                        console.log(
                            `✓ Notification history ID: ${historyId}`
                        );

                        await processGmailHistory(
                            historyId
                        );
                    }
                );
            }
        );

        subscription.on(
            "error",
            (error) => {
                console.error("");
                console.error(
                    "Pub/Sub error:"
                );
                console.error(error);
                console.error("");

                setComponentError(
                    "gmail",
                    error
                );
            }
        );
    } catch (error) {
        console.error("");
        console.error(
            "Gmail Pub/Sub processor failed to start:"
        );
        console.error(error);
        console.error("");

        setComponentOffline(
            "gmail",
            error instanceof Error
                ? error.message
                : String(error)
        );
    }
}