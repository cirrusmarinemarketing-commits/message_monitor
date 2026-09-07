import { PubSub, Message } from "@google-cloud/pubsub";
import { processGmailHistory } from "./processor";
import {
    setComponentHealthy,
    setComponentError,
    setComponentOffline,
} from "../services/system-status.service";

const PROJECT_ID = "vivid-kite-458204-h8";
const SUBSCRIPTION_NAME = "gmail-notifications-sub";

// Simple in-process queue.
// Pub/Sub messages will be processed one at a time.
let processingQueue: Promise<void> = Promise.resolve();

function enqueue(
    message: Message,
    task: () => Promise<void>
) {
    processingQueue = processingQueue
        .then(async () => {
            try {
                await task();

                message.ack();

                setComponentHealthy("gmail");

                console.log("✓ Pub/Sub message acknowledged");
                console.log("");
            } catch (error) {
                console.error("");
                console.error("Gmail processing failed:");
                console.error(error);
                console.error("");

                setComponentError("gmail", error);

                message.nack();
            }
        })
        .catch((error) => {
            console.error("");
            console.error("Queue error:");
            console.error(error);
            console.error("");
        });
}

/**
 * Starts the Gmail Pub/Sub listener in the current process.
 *
 * This MUST run in the same process as the Express server (server.ts):
 * both share the same in-memory conversation/case/handoff stores
 * (conversation.service.ts, case.service.ts, human-handoff.service.ts).
 * Running it as a separate OS process means Gmail messages get stored in
 * that process's own memory, invisible to the dashboard API served by the
 * Express process - conversations and cases created from Gmail would never
 * show up in /api/dashboard/*.
 *
 * Does not throw: a startup failure (e.g. missing GCP credentials in a
 * local/dev environment) is logged and swallowed so it never takes down
 * the shared server process. WhatsApp and the dashboard keep working even
 * if Gmail Pub/Sub can't start.
 */
export function startGmailPubSubListener(): void {
    try {
        console.log("Starting Gmail Pub/Sub processor...");

        const pubsub = new PubSub({
            projectId: PROJECT_ID,
        });

        const subscription = pubsub.subscription(
            SUBSCRIPTION_NAME
        );

        console.log("");
        console.log(`✓ Project: ${PROJECT_ID}`);
        console.log(
            `✓ Subscription: ${SUBSCRIPTION_NAME}`
        );
        console.log("");
        console.log("Listening for Gmail notifications...");
        console.log("");

        setComponentHealthy("gmail");

        subscription.on("message", (message) => {
            enqueue(message, async () => {
                console.log("========================================");
                console.log("GMAIL NOTIFICATION RECEIVED");
                console.log("========================================");
                console.log(
                    `Pub/Sub Message ID: ${message.id}`
                );
                console.log(
                    `Data: ${message.data.toString()}`
                );

                const notification = JSON.parse(
                    message.data.toString()
                );

                const historyId = notification.historyId;

                if (!historyId) {
                    console.log("⚠ No historyId found");
                    return;
                }

                await processGmailHistory(historyId);
            });
        });

        subscription.on("error", (error) => {
            console.error("");
            console.error("Pub/Sub error:");
            console.error(error);
            console.error("");

            setComponentError("gmail", error);
        });
    } catch (error) {
        console.error("");
        console.error("Gmail Pub/Sub processor failed to start:");
        console.error(error);
        console.error("");

        setComponentOffline(
            "gmail",
            error instanceof Error ? error.message : String(error)
        );
    }
}
