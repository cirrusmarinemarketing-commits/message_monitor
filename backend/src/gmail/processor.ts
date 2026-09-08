import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

import { normalizeGmailMessage } from "./normalizer";
import {
    getGmailState,
    saveGmailState,
} from "./gmail-state.service";

import { ingestNormalizedMessage } from "../services/pipeline.service";
import { recordActivity } from "../services/activity.service";

const TOKEN_PATH = path.join(
    process.cwd(),
    "token.json"
);

const CREDENTIALS_PATH = path.join(
    process.cwd(),
    "credentials.json"
);

function decodeBase64Url(data: string): string {
    return Buffer.from(
        data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
    ).toString("utf8");
}

function htmlToText(html: string): string {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\r/g, "")
        .replace(/\n\s*\n\s*\n+/g, "\n\n")
        .trim();
}

function findBody(payload: any): string {
    if (!payload) {
        return "";
    }

    if (
        payload.mimeType === "text/plain" &&
        payload.body?.data
    ) {
        return decodeBase64Url(
            payload.body.data
        ).trim();
    }

    if (payload.parts) {
        // Prefer plain text
        for (const part of payload.parts) {
            if (
                part.mimeType === "text/plain" &&
                part.body?.data
            ) {
                return decodeBase64Url(
                    part.body.data
                ).trim();
            }
        }

        // Then try nested parts
        for (const part of payload.parts) {
            const nestedBody = findBody(part);

            if (nestedBody) {
                return nestedBody;
            }
        }

        // Finally fallback to HTML
        for (const part of payload.parts) {
            if (
                part.mimeType === "text/html" &&
                part.body?.data
            ) {
                return htmlToText(
                    decodeBase64Url(
                        part.body.data
                    )
                );
            }
        }
    }

    if (
        payload.mimeType === "text/html" &&
        payload.body?.data
    ) {
        return htmlToText(
            decodeBase64Url(
                payload.body.data
            )
        );
    }

    return "";
}

function getHeader(
    headers: any[],
    name: string
): string {
    return (
        headers.find(
            (header) =>
                header.name?.toLowerCase() ===
                name.toLowerCase()
        )?.value ?? ""
    );
}

function shouldIgnoreEmail(
    headers: any[],
    labelIds: string[] = []
): {
    ignore: boolean;
    reason: string;
} {
    const from = getHeader(
        headers,
        "From"
    ).toLowerCase();

    const subject = getHeader(
        headers,
        "Subject"
    ).toLowerCase();

    if (
        labelIds.includes("SPAM") ||
        labelIds.includes("TRASH")
    ) {
        return {
            ignore: true,
            reason:
                "Gmail marked as spam or trash",
        };
    }

    const ignoredSenderPatterns = [
        "newsletter@",
        "news@",
        "marketing@",
        "notifications@",
        "notification@",
        "updates@",
        "update@",
        "mailer@",
        "campaign@",
        "promotions@",
    ];

    if (
        ignoredSenderPatterns.some(
            (pattern) =>
                from.includes(pattern)
        )
    ) {
        return {
            ignore: true,
            reason:
                "Newsletter or automated sender",
        };
    }

    const ignoredDomains = [
        "tiktok.com",
        "facebookmail.com",
        "facebook.com",
        "instagram.com",
        "youtube.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
    ];

    if (
        ignoredDomains.some(
            (domain) =>
                from.includes(domain)
        )
    ) {
        return {
            ignore: true,
            reason:
                "Social media or promotional email",
        };
    }

    const ignoredSubjectPatterns = [
        "newsletter",
        "unsubscribe",
        "weekly digest",
        "daily digest",
        "promotion",
        "promotional",
        "special offer",
        "sale",
        "discount",
        "recommended for you",
        "you may also like",
        "notification",
        "notifications",
        "digest",
    ];

    if (
        ignoredSubjectPatterns.some(
            (pattern) =>
                subject.includes(pattern)
        )
    ) {
        return {
            ignore: true,
            reason:
                "Newsletter, promotion, or notification",
        };
    }

    return {
        ignore: false,
        reason: "",
    };
}

function getErrorStatus(
    error: any
): number | null {
    return (
        error?.response?.status ??
        error?.status ??
        (typeof error?.code === "number"
            ? error.code
            : null) ??
        null
    );
}

function isNotFoundError(
    error: any
): boolean {
    return getErrorStatus(error) === 404;
}

async function getGmail() {
    const tokenRaw =
        await fs.readFile(
            TOKEN_PATH,
            "utf8"
        );

    const credentials =
        JSON.parse(tokenRaw);

    const credentialsRaw =
        await fs.readFile(
            CREDENTIALS_PATH,
            "utf8"
        );

    const oauthCredentials =
        JSON.parse(credentialsRaw);

    const clientConfig =
        oauthCredentials.installed ??
        oauthCredentials.web;

    if (!clientConfig) {
        throw new Error(
            "Invalid Gmail OAuth credentials"
        );
    }

    const auth =
        new google.auth.OAuth2(
            clientConfig.client_id,
            clientConfig.client_secret,
            "http://localhost"
        );

    auth.setCredentials(
        credentials
    );

    return google.gmail({
        version: "v1",
        auth,
    });
}

async function createBaseline(
    historyId: string,
    reason: string
) {
    await saveGmailState(
        historyId
    );

    console.log("");
    console.log(
        "----------------------------------------"
    );
    console.log(
        "GMAIL HISTORY BASELINE"
    );
    console.log(
        "----------------------------------------"
    );
    console.log(
        `Reason: ${reason}`
    );
    console.log(
        `Saved history ID: ${historyId}`
    );
    console.log(
        "Old history will not be replayed."
    );
    console.log(
        "Future Gmail changes will be processed."
    );
    console.log(
        "----------------------------------------"
    );
    console.log("");
}

export async function processGmailHistory(
    notificationHistoryId: string
) {
    const gmail =
        await getGmail();

    const state =
        await getGmailState();

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "PROCESSING GMAIL HISTORY"
    );
    console.log(
        "========================================"
    );

    console.log(
        `Previous history ID: ${state.historyId ?? "null"
        }`
    );

    console.log(
        `Notification history ID: ${notificationHistoryId
        }`
    );

    /*
     * FIRST RUN
     *
     * We do not replay old Gmail messages.
     * We only establish the current history
     * position in PostgreSQL.
     */
    if (!state.historyId) {
        await createBaseline(
            notificationHistoryId,
            "No Gmail history ID stored in PostgreSQL"
        );

        return;
    }

    const messageIds =
        new Set<string>();

    let pageToken:
        | string
        | undefined;

    let latestHistoryId:
        | string
        | null = null;

    let totalHistoryRecords = 0;

    /*
     * Read Gmail history.
     *
     * Gmail returns history chronologically.
     * If there are multiple pages, process all
     * pages before advancing our stored state.
     */
    do {
        let response;

        try {
            response =
                await gmail.users.history.list(
                    {
                        userId: "me",
                        startHistoryId:
                            state.historyId,
                        historyTypes: [
                            "messageAdded",
                        ],
                        pageToken,
                    }
                );
        } catch (error) {
            if (
                isNotFoundError(error)
            ) {
                console.warn("");
                console.warn(
                    "----------------------------------------"
                );
                console.warn(
                    "GMAIL HISTORY ID NOT FOUND"
                );
                console.warn(
                    "----------------------------------------"
                );
                console.warn(
                    `Stored history ID: ${state.historyId}`
                );
                console.warn(
                    `Notification history ID: ${notificationHistoryId}`
                );
                console.warn(
                    "The Gmail history ID is expired or invalid."
                );
                console.warn(
                    "Creating a new PostgreSQL baseline."
                );
                console.warn(
                    "----------------------------------------"
                );

                await createBaseline(
                    notificationHistoryId,
                    "Stored Gmail history ID expired or became invalid"
                );

                return;
            }

            throw error;
        }

        const history =
            response.data.history ??
            [];

        totalHistoryRecords +=
            history.length;

        if (
            response.data.historyId
        ) {
            latestHistoryId =
                response.data.historyId;
        }

        for (
            const record of history
        ) {
            for (
                const item of
                record.messagesAdded ??
                []
            ) {
                const messageId =
                    item.message?.id;

                if (messageId) {
                    messageIds.add(
                        messageId
                    );
                }
            }
        }

        pageToken =
            response.data.nextPageToken ??
            undefined;

        console.log(
            `✓ History page processed: ${history.length} records`
        );

        if (pageToken) {
            console.log(
                "✓ More history pages found"
            );
        }
    } while (pageToken);

    console.log("");
    console.log(
        `✓ Total history records: ${totalHistoryRecords}`
    );
    console.log(
        `✓ New messages: ${messageIds.size}`
    );

    /*
     * Process every new Gmail message.
     */
    for (
        const messageId of messageIds
    ) {
        let detail;

        try {
            detail =
                await gmail.users.messages.get(
                    {
                        userId: "me",
                        id: messageId,
                        format: "full",
                    }
                );
        } catch (error) {
            /*
             * A message can disappear between
             * history.list and messages.get.
             *
             * This must NOT stop the entire batch.
             */
            if (
                isNotFoundError(error)
            ) {
                console.warn("");
                console.warn(
                    "----------------------------------------"
                );
                console.warn(
                    "GMAIL MESSAGE NOT FOUND"
                );
                console.warn(
                    "----------------------------------------"
                );
                console.warn(
                    `Message ID: ${messageId}`
                );
                console.warn(
                    "Skipping unavailable message."
                );
                console.warn(
                    "----------------------------------------"
                );

                continue;
            }

            /*
             * Other errors such as quota,
             * network or server errors must
             * bubble up so Pub/Sub can retry.
             */
            throw error;
        }

        const payload =
            detail.data.payload;

        const headers =
            payload?.headers ??
            [];

        const labelIds =
            detail.data.labelIds ??
            [];

        const filterResult =
            shouldIgnoreEmail(
                headers,
                labelIds
            );

        if (
            filterResult.ignore
        ) {
            console.log("");
            console.log(
                "----------------------------------------"
            );
            console.log(
                "EMAIL IGNORED"
            );
            console.log(
                "----------------------------------------"
            );

            console.log(
                `From:    ${getHeader(
                    headers,
                    "From"
                )}`
            );

            console.log(
                `Subject: ${getHeader(
                    headers,
                    "Subject"
                )}`
            );

            console.log(
                `Reason:  ${filterResult.reason}`
            );

            console.log(
                "----------------------------------------"
            );

            continue;
        }

        const body =
            findBody(payload);

        console.log("");
        console.log(
            "----------------------------------------"
        );
        console.log(
            "NEW EMAIL"
        );
        console.log(
            "----------------------------------------"
        );

        console.log(
            `Message ID: ${messageId}`
        );

        console.log(
            `From:       ${getHeader(
                headers,
                "From"
            )}`
        );

        console.log(
            `To:         ${getHeader(
                headers,
                "To"
            )}`
        );

        console.log(
            `Subject:    ${getHeader(
                headers,
                "Subject"
            )}`
        );

        console.log(
            `Date:       ${getHeader(
                headers,
                "Date"
            )}`
        );

        console.log("");
        console.log(
            "BODY"
        );

        console.log(
            "----------------------------------------"
        );

        console.log(
            body ||
            "[No plain text body found]"
        );

        console.log(
            "----------------------------------------"
        );

        /*
         * Convert Gmail message into our
         * unified communication format.
         */
        const normalizedMessage =
            normalizeGmailMessage(
                {
                    messageId,
                    threadId:
                        detail.data
                            .threadId ??
                        messageId,

                    from: getHeader(
                        headers,
                        "From"
                    ),

                    to: getHeader(
                        headers,
                        "To"
                    ),

                    subject:
                        getHeader(
                            headers,
                            "Subject"
                        ),

                    body,

                    timestamp:
                        detail.data
                            .internalDate
                            ? new Date(
                                Number(
                                    detail.data
                                        .internalDate
                                )
                            ).toISOString()
                            : getHeader(
                                headers,
                                "Date"
                            ),
                }
            );

        console.log("");
        console.log(
            "NORMALIZED MESSAGE"
        );

        console.log(
            "----------------------------------------"
        );

        console.log(
            JSON.stringify(
                normalizedMessage,
                null,
                2
            )
        );

        console.log(
            "----------------------------------------"
        );

        recordActivity({
            channel: "email",
            type: "gmail_received",

            conversationId:
                normalizedMessage
                    .conversationId,

            customerName:
                normalizedMessage.sender,

            status: "success",

            message:
                normalizedMessage.subject
                    ? `Email: ${normalizedMessage.subject}`
                    : "Gmail message received",
        });

        /*
         * Wait until the unified pipeline
         * has completed.
         */
        await ingestNormalizedMessage(
            normalizedMessage,
            {
                customerName:
                    normalizedMessage.sender,
            }
        );

        console.log("");
        console.log(
            "✓ Message handed to unified pipeline"
        );
    }

    /*
     * Advance Gmail state ONLY after
     * the complete history batch has been
     * processed.
     */
    if (latestHistoryId) {
        try {
            const currentStateId =
                BigInt(
                    state.historyId
                );

            const latestId =
                BigInt(
                    latestHistoryId
                );

            if (
                latestId >=
                currentStateId
            ) {
                await saveGmailState(
                    latestHistoryId
                );

                console.log("");
                console.log(
                    `✓ PostgreSQL Gmail state updated: ${latestHistoryId}`
                );
            } else {
                console.log("");
                console.log(
                    `⚠ Gmail returned older history ID: ${latestHistoryId}`
                );

                console.log(
                    `✓ PostgreSQL state remains: ${state.historyId}`
                );
            }
        } catch {
            /*
             * History IDs should be numeric strings.
             * If Gmail ever returns something unexpected,
             * save it rather than crashing the processor.
             */
            await saveGmailState(
                latestHistoryId
            );

            console.log("");
            console.log(
                `✓ PostgreSQL Gmail state updated: ${latestHistoryId}`
            );
        }
    }

    console.log("");
    console.log(
        "✓ Gmail history processing completed"
    );
    console.log("");
}