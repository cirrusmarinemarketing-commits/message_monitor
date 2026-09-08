import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString = process.env.DATABASE_URL;
//console.log(connectionString);
if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
}

// Render's managed Postgres requires SSL for connections from outside its
// own network (a plain connection gets reset by the server). Deployed on
// Render itself this is a no-op either way; connecting from local dev
// needs it explicitly. rejectUnauthorized: false because Render's cert
// chain isn't in Node's default trust store.
export const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: {
        rejectUnauthorized: false,
    },
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

export async function testDatabaseConnection() {
    const result = await pool.query("SELECT NOW() AS now");
    return result.rows[0];
}