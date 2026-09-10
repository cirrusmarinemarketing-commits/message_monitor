import { pool } from "../database";

type StaffContact = {
    phone: string;
    name: string;
};

let cache: StaffContact[] | null = null;
let cacheExpiresAt = 0;

const CACHE_TTL_MS = 60_000;

function normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "");
}

function normalizeName(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

async function loadStaffContacts(): Promise<StaffContact[]> {
    const now = Date.now();

    if (cache && now < cacheExpiresAt) {
        return cache;
    }

    const result = await pool.query(
        "SELECT phone, name FROM staff_contacts"
    );

    cache = result.rows
        .map((row) => ({
            phone: normalizePhone(String(row.phone ?? "")),
            name: String(row.name ?? "").trim(),
        }))
        .filter((item) => item.phone || item.name);

    cacheExpiresAt = now + CACHE_TTL_MS;

    return cache;
}

export async function isStaffNumber(
    phone: string
): Promise<boolean> {
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
        return false;
    }

    const staff = await loadStaffContacts();

    return staff.some(
        (item) => item.phone === normalizedPhone
    );
}

export async function getStaffName(
    phone: string
): Promise<string | null> {
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
        return null;
    }

    const staff = await loadStaffContacts();

    return (
        staff.find(
            (item) => item.phone === normalizedPhone
        )?.name ?? null
    );
}

export async function isStaffName(
    name: string
): Promise<boolean> {
    const normalizedName = normalizeName(name);

    if (!normalizedName) {
        return false;
    }

    const staff = await loadStaffContacts();

    return staff.some(
        (item) =>
            normalizeName(item.name) === normalizedName
    );
}

export async function getStaffNameByName(
    name: string
): Promise<string | null> {
    const normalizedName = normalizeName(name);

    if (!normalizedName) {
        return null;
    }

    const staff = await loadStaffContacts();

    return (
        staff.find(
            (item) =>
                normalizeName(item.name) ===
                normalizedName
        )?.name ?? null
    );
}