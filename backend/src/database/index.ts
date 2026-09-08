import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
}

export const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
});

export async function testDatabaseConnection() {
    const result = await pool.query("SELECT NOW() AS now");
    return result.rows[0];
}