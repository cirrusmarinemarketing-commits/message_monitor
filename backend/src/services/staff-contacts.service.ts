import { pool } from "../database";

let cache: Set<string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60_000; // รีเฟรชทุก 1 นาที ไม่ต้อง query DB ทุกข้อความ

async function loadStaffNumbers(): Promise<Set<string>> {
    const now = Date.now();
    if (cache && now < cacheExpiresAt) return cache;

    const result = await pool.query("SELECT phone FROM staff_contacts");
    cache = new Set(result.rows.map((r) => r.phone));
    cacheExpiresAt = now + CACHE_TTL_MS;
    return cache;
}

export async function isStaffNumber(phone: string): Promise<boolean> {
    const staff = await loadStaffNumbers();
    return staff.has(phone);
}

export async function getStaffName(phone: string): Promise<string | null> {
    const result = await pool.query(
        "SELECT name FROM staff_contacts WHERE phone = $1",
        [phone]
    );
    return result.rows[0]?.name ?? null;
}