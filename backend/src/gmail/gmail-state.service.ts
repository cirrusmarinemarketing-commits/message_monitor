import { pool } from "../database";

export async function getGmailState() {
    const result = await pool.query(`
        SELECT history_id, watch_expiration
        FROM gmail_sync_state
        WHERE id = 1
    `);

    if (result.rows.length === 0) {
        return {
            historyId: null,
            watchExpiration: null,
        };
    }

    return {
        historyId: result.rows[0].history_id,
        watchExpiration: result.rows[0].watch_expiration,
    };
}

export async function saveGmailState(
    historyId: string,
    watchExpiration?: number | null
) {
    await pool.query(
        `
        INSERT INTO gmail_sync_state (
            id,
            history_id,
            watch_expiration,
            updated_at
        )
        VALUES (1, $1, $2, NOW())
        ON CONFLICT (id)
        DO UPDATE SET
            history_id = EXCLUDED.history_id,
            watch_expiration = COALESCE(
                EXCLUDED.watch_expiration,
                gmail_sync_state.watch_expiration
            ),
            updated_at = NOW()
        `,
        [
            historyId,
            watchExpiration
                ? new Date(watchExpiration)
                : null,
        ]
    );
}