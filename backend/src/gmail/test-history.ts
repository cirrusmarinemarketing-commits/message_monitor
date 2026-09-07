import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

const TOKEN_PATH = path.join(process.cwd(), "token.json");

// ใช้ historyId ที่เราได้รับจาก Pub/Sub
const START_HISTORY_ID = "1952719";

function decodeBase64Url(data: string): string {
    return Buffer.from(
        data.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
    ).toString("utf8");
}

function findBody(payload: any): string {
    if (!payload) {
        return "";
    }

    if (
        payload.mimeType === "text/plain" &&
        payload.body?.data
    ) {
        return decodeBase64Url(payload.body.data);
    }

    if (payload.parts) {
        for (const part of payload.parts) {
            const body = findBody(part);

            if (body) {
                return body;
            }
        }
    }

    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    return "";
}

async function main() {
    console.log("Starting Gmail History test...");

    const tokenRaw = await fs.readFile(TOKEN_PATH, "utf8");
    const credentials = JSON.parse(tokenRaw);

    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);

    const gmail = google.gmail({
        version: "v1",
        auth,
    });

    console.log("");
    console.log(`✓ Start history ID: ${START_HISTORY_ID}`);

    const response = await gmail.users.history.list({
        userId: "me",
        startHistoryId: START_HISTORY_ID,
        historyTypes: ["messageAdded"],
    });

    console.log("");
    console.log(`✓ Current history ID: ${response.data.historyId}`);

    const history = response.data.history ?? [];

    console.log(`✓ History records: ${history.length}`);

    const messageIds = new Set<string>();

    for (const record of history) {
        for (const item of record.messagesAdded ?? []) {
            const messageId = item.message?.id;

            if (messageId) {
                messageIds.add(messageId);
            }
        }
    }

    console.log(`✓ New messages found: ${messageIds.size}`);

    if (messageIds.size === 0) {
        console.log("");
        console.log("No new emails found.");
        return;
    }

    for (const messageId of messageIds) {
        console.log("");
        console.log("========================================");
        console.log("EMAIL FOUND");
        console.log("========================================");
        console.log(`Message ID: ${messageId}`);

        const detail = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full",
        });

        const payload = detail.data.payload;
        const headers = payload?.headers ?? [];

        const getHeader = (name: string) =>
            headers.find(
                (header) =>
                    header.name?.toLowerCase() === name.toLowerCase()
            )?.value ?? "";

        const body = findBody(payload);

        console.log(`From:    ${getHeader("From")}`);
        console.log(`To:      ${getHeader("To")}`);
        console.log(`Subject: ${getHeader("Subject")}`);
        console.log(`Date:    ${getHeader("Date")}`);

        console.log("");
        console.log("BODY");
        console.log("----------------------------------------");
        console.log(body || "[No plain text body found]");
        console.log("----------------------------------------");
    }

    console.log("");
    console.log("✓ Gmail History test completed");
}

main().catch((error) => {
    console.error("");
    console.error("Gmail History test failed:");
    console.error(error);
    process.exit(1);
});