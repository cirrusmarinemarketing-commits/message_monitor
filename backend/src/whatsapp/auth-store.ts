import fs from "fs";
import path from "path";
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const SESSION_ID = "default"; // one row = one linked WhatsApp number

async function ensureTable(): Promise<void> {
    await pool.query(`
		CREATE TABLE IF NOT EXISTS whatsapp_auth (
			session_id TEXT PRIMARY KEY,
			files JSONB NOT NULL,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`);
}

/** Call this BEFORE useMultiFileAuthState, to rebuild the auth folder from the DB. */
export async function restoreAuthFolder(folder: string): Promise<void> {
    await ensureTable();

    const res = await pool.query(
        "SELECT files FROM whatsapp_auth WHERE session_id = $1",
        [SESSION_ID]
    );

    if (res.rows.length === 0) {
        console.log("No saved WhatsApp session in DB yet — will need a fresh QR scan.");
        return;
    }

    const files: Record<string, string> = res.rows[0].files;
    fs.mkdirSync(folder, { recursive: true });
    for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(folder, filename), content, "utf8");
    }
    console.log(`Restored ${Object.keys(files).length} WhatsApp auth file(s) from database.`);
}

/** Call this whenever creds/keys change, to save the auth folder into the DB. */
export async function backupAuthFolder(folder: string): Promise<void> {
    if (!fs.existsSync(folder)) return;

    const filenames = fs.readdirSync(folder);
    const files: Record<string, string> = {};
    for (const filename of filenames) {
        files[filename] = fs.readFileSync(path.join(folder, filename), "utf8");
    }

    await ensureTable();
    await pool.query(
        `INSERT INTO whatsapp_auth (session_id, files, updated_at)
		 VALUES ($1, $2, now())
		 ON CONFLICT (session_id) DO UPDATE SET files = $2, updated_at = now()`,
        [SESSION_ID, JSON.stringify(files)]
    );
}