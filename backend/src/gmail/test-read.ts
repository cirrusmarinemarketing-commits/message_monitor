import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

const TOKEN_PATH = path.join(process.cwd(), "token.json");

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

    // Plain text body
    if (
        payload.mimeType === "text/plain" &&
        payload.body?.data
    ) {
        return decodeBase64Url(payload.body.data);
    }

    // Search nested parts
    if (payload.parts) {
        for (const part of payload.parts) {
            const body = findBody(part);

            if (body) {
                return body;
            }
        }
    }

    // Fallback
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }

    return "";
}

async function main() {
    console.log("Starting Gmail email body test...");

    const tokenRaw = await fs.readFile(TOKEN_PATH, "utf8");
    const credentials = JSON.parse(tokenRaw);

    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);

    const gmail = google.gmail({
        version: "v1",
        auth,
    });

    // Verify account
    const profile = await gmail.users.getProfile({
        userId: "me",
    });

    console.log("");
    console.log(`✓ Gmail account: ${profile.data.emailAddress}`);

    // Get latest email
    const listResponse = await gmail.users.messages.list({
        userId: "me",
        maxResults: 1,
    });

    const message = listResponse.data.messages?.[0];

    if (!message?.id) {
        console.log("No emails found.");
        return;
    }

    console.log(`✓ Latest message ID: ${message.id}`);

    // Get full email
    const detail = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
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

    console.log("");
    console.log("========================================");
    console.log("EMAIL");
    console.log("========================================");
    console.log(`From:    ${getHeader("From")}`);
    console.log(`To:      ${getHeader("To")}`);
    console.log(`Subject: ${getHeader("Subject")}`);
    console.log(`Date:    ${getHeader("Date")}`);
    console.log("");
    console.log("BODY");
    console.log("----------------------------------------");
    console.log(body || "[No plain text body found]");
    console.log("----------------------------------------");
    console.log("");
    console.log("✓ Gmail email body test completed");
}

main().catch((error) => {
    console.error("");
    console.error("Gmail email body test failed:");
    console.error(error);
    process.exit(1);
});