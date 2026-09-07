import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";

const TOKEN_PATH = path.join(process.cwd(), "token.json");

const TOPIC_NAME =
    "projects/vivid-kite-458204-h8/topics/gmail-notifications";

async function main() {
    console.log("Starting Gmail watch...");

    const tokenRaw = await fs.readFile(TOKEN_PATH, "utf8");
    const credentials = JSON.parse(tokenRaw);

    const auth = new google.auth.OAuth2();
    auth.setCredentials(credentials);

    const gmail = google.gmail({
        version: "v1",
        auth,
    });

    const profile = await gmail.users.getProfile({
        userId: "me",
    });

    console.log("");
    console.log(`✓ Gmail account: ${profile.data.emailAddress}`);
    console.log(`✓ Current historyId: ${profile.data.historyId}`);

    const response = await gmail.users.watch({
        userId: "me",
        requestBody: {
            topicName: TOPIC_NAME,
        },
    });

    console.log("");
    console.log("========================================");
    console.log("GMAIL WATCH");
    console.log("========================================");
    console.log(`History ID: ${response.data.historyId}`);
    console.log(`Expiration: ${response.data.expiration}`);
    console.log("========================================");
    console.log("");
    console.log("✓ Gmail watch started");
}

main().catch((error) => {
    console.error("");
    console.error("Gmail watch failed:");
    console.error(error);
    process.exit(1);
});