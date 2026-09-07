import fs from "fs/promises";
import path from "path";
import http from "http";
import { URL } from "url";
import { google } from "googleapis";

const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
];

const CREDENTIALS_PATH = path.join(
    process.cwd(),
    "credentials.json"
);

const TOKEN_PATH = path.join(
    process.cwd(),
    "token.json"
);

async function main() {
    console.log("Starting Gmail OAuth...\n");

    // --------------------------------------------------
    // 1. Load OAuth credentials
    // --------------------------------------------------

    const credentialsFile = await fs.readFile(
        CREDENTIALS_PATH,
        "utf8"
    );

    const credentials = JSON.parse(credentialsFile);

    const { client_id, client_secret } = credentials.installed;

    console.log("✓ credentials.json loaded");
    console.log(`✓ Project: ${credentials.installed.project_id}`);

    // --------------------------------------------------
    // 2. Create OAuth client
    // --------------------------------------------------

    const redirectUri = "http://localhost";

    const oauth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirectUri
    );

    // --------------------------------------------------
    // 3. Start local callback server
    // --------------------------------------------------

    const server = http.createServer(async (req, res) => {
        try {
            if (!req.url) {
                res.writeHead(400);
                res.end("Missing request URL");
                return;
            }

            const requestUrl = new URL(
                req.url,
                "http://localhost"
            );

            const code = requestUrl.searchParams.get("code");
            const error = requestUrl.searchParams.get("error");

            if (error) {
                console.error(`\nOAuth error: ${error}`);

                res.writeHead(400, {
                    "Content-Type": "text/html",
                });

                res.end(`
          <h2>Gmail OAuth failed</h2>
          <p>${error}</p>
          <p>You can close this window.</p>
        `);

                server.close();
                return;
            }

            if (!code) {
                res.writeHead(200, {
                    "Content-Type": "text/html",
                });

                res.end(`
          <h2>Waiting for Gmail OAuth...</h2>
        `);

                return;
            }

            console.log("\n✓ Google authorization code received");

            const { tokens } = await oauth2Client.getToken(code);

            oauth2Client.setCredentials(tokens);

            await fs.writeFile(
                TOKEN_PATH,
                JSON.stringify(tokens, null, 2),
                "utf8"
            );

            console.log("✓ Gmail token received");
            console.log("✓ token.json created");

            // --------------------------------------------------
            // 4. Verify Gmail connection
            // --------------------------------------------------

            const gmail = google.gmail({
                version: "v1",
                auth: oauth2Client,
            });

            const profile = await gmail.users.getProfile({
                userId: "me",
            });

            console.log(
                `✓ Gmail connected: ${profile.data.emailAddress}`
            );

            res.writeHead(200, {
                "Content-Type": "text/html",
            });

            res.end(`
        <html>
          <body>
            <h2>✓ Gmail connected!</h2>
            <p>Account: ${profile.data.emailAddress}</p>
            <p>You can close this browser window.</p>
          </body>
        </html>
      `);

            setTimeout(() => {
                server.close(() => {
                    console.log("\nOAuth server closed.");
                    process.exit(0);
                });
            }, 500);

        } catch (error) {
            console.error("\nGmail OAuth failed:");
            console.error(error);

            res.writeHead(500, {
                "Content-Type": "text/html",
            });

            res.end(`
        <h2>Gmail OAuth failed</h2>
        <p>Check the terminal for details.</p>
      `);

            server.close();
            process.exit(1);
        }
    });

    // --------------------------------------------------
    // 5. Listen on localhost
    // --------------------------------------------------

    server.listen(80, "localhost", () => {
        console.log("✓ OAuth callback server running");
        console.log("✓ Listening on http://localhost");

        // ------------------------------------------------
        // 6. Generate Google authorization URL
        // ------------------------------------------------

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: SCOPES,
        });

        console.log("\n========================================");
        console.log("OPEN THIS URL IN YOUR BROWSER:");
        console.log("========================================\n");

        console.log(authUrl);

        console.log("\n========================================");
        console.log("Waiting for Google authorization...");
        console.log("========================================\n");
    });
}

main().catch((error) => {
    console.error("\nGmail OAuth failed:");
    console.error(error);
    process.exit(1);
});