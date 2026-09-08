import path from "path";
import pino from "pino";

import {
	default as makeWASocket,
	useMultiFileAuthState,
	DisconnectReason,
	fetchLatestBaileysVersion,
	type WASocket,
} from "@whiskeysockets/baileys";

import { normalizeWhatsAppMessage } from "./normalizer";
import { ingestNormalizedMessage } from "../services/pipeline.service";
import { recordActivity } from "../services/activity.service";
import {
	setComponentHealthy,
	setComponentError,
	setComponentOffline,
} from "../services/system-status.service";
import { restoreAuthFolder, backupAuthFolder } from "./auth-store";

/**
 * Unofficial WhatsApp connection using Baileys (speaks the same protocol
 * as web.whatsapp.com — no Meta Business API / verification required).
 *
 * Feeds the exact same `ingestNormalizedMessage` pipeline that
 * `routes/whatsapp.ts` (the official Meta webhook handler) already uses,
 * so conversation storage, AI analysis, cases, and handoffs all work
 * identically regardless of which connection method is active.
 *
 * Read-only: this never sends messages. Uses phone-number pairing (a
 * one-time 8-digit code typed into WhatsApp on the linked phone) instead
 * of scanning a QR code, since this runs on a headless server (Render).
 */

const AUTH_FOLDER = path.join(__dirname, "..", "..", "auth_info");

function extractText(msg: any): string | null {
	const m = msg.message;
	if (!m) return null;
	if (m.conversation) return m.conversation;
	if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
	if (m.imageMessage?.caption) return `[image] ${m.imageMessage.caption}`;
	if (m.videoMessage?.caption) return `[video] ${m.videoMessage.caption}`;
	if (m.documentMessage) return `[document] ${m.documentMessage.fileName || ""}`;
	if (m.audioMessage) return "[audio message]";
	if (m.stickerMessage) return "[sticker]";
	return null;
}

export async function startBaileysWhatsApp(): Promise<WASocket> {
	await restoreAuthFolder(AUTH_FOLDER);
	const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

	let version: [number, number, number] = [2, 3000, 1015901307];
	try {
		const fetched = await fetchLatestBaileysVersion();
		version = fetched.version;
	} catch {
		console.log("Could not fetch latest Baileys version, using fallback.");
	}

	const sock = makeWASocket({
		version,
		auth: state,
		logger: pino({ level: "silent" }) as any,
		printQRInTerminal: false,
	});

	sock.ev.on("creds.update", async () => {
		await saveCreds();
		await backupAuthFolder(AUTH_FOLDER).catch((err) =>
			console.error("Failed to backup WhatsApp auth to DB:", err)
		);
	});

	// Request a pairing code once, right after the socket is created — not
	// inside connection.update, and not immediately. Asking too early or
	// more than once causes Baileys to throw "Connection Closed" (428).
	if (!sock.authState.creds.registered) {
		const phoneNumber = process.env.WHATSAPP_PHONE_NUMBER;
		if (!phoneNumber) {
			console.error(
				"WHATSAPP_PHONE_NUMBER env var is not set. Set it (e.g. 66812345678, no + or spaces) to get a pairing code."
			);
		} else {
			setTimeout(async () => {
				try {
					const code = await sock.requestPairingCode(phoneNumber);
					console.log("\n========== WHATSAPP PAIRING CODE ==========");
					console.log(`Code: ${code}`);
					console.log("On your phone: WhatsApp → Settings → Linked Devices");
					console.log("→ Link a Device → Link with phone number instead");
					console.log("=============================================\n");
				} catch (err) {
					console.error("Failed to request pairing code:", err);
				}
			}, 3000);
		}
	}

	sock.ev.on("connection.update", (update) => {
		const { connection, lastDisconnect } = update;

		if (connection === "open") {
			console.log("✓ WhatsApp (Baileys) connected");
			setComponentHealthy("whatsapp");
			backupAuthFolder(AUTH_FOLDER).catch((err) =>
				console.error("Failed to backup WhatsApp auth to DB:", err)
			);
		}

		if (connection === "close") {
			const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
			const loggedOut = statusCode === DisconnectReason.loggedOut;

			if (loggedOut) {
				console.log(
					"WhatsApp session logged out. Clear the whatsapp_auth row in Postgres and restart to re-link."
				);
				setComponentOffline("whatsapp", "logged_out");
			} else {
				console.log("WhatsApp connection closed, reconnecting…");
				setComponentError("whatsapp", lastDisconnect?.error ?? "connection closed");
				startBaileysWhatsApp().catch((err) =>
					console.error("Failed to reconnect WhatsApp:", err)
				);
			}
		}
	});

	sock.ev.on("messages.upsert", ({ messages, type }) => {
		if (type !== "notify") return;

		for (const msg of messages) {
			if (!msg.message) continue;
			if (msg.key.fromMe) continue;

			const jid = msg.key.remoteJid;
			if (!jid || jid === "status@broadcast") continue;

			const text = extractText(msg);
			if (text === null) continue;

			const waId = jid.split("@")[0] ?? jid;
			const customerName = msg.pushName || null;

			const normalized = normalizeWhatsAppMessage({
				messageId: msg.key.id ?? `baileys-${Date.now()}`,
				waId,
				from: waId,
				text,
				timestamp: String(msg.messageTimestamp ?? Math.floor(Date.now() / 1000)),
			});

			recordActivity({
				channel: "whatsapp",
				type: "whatsapp_received",
				conversationId: waId,
				customerName,
				status: "success",
				message: "WhatsApp message received (unofficial/Baileys)",
			});

			ingestNormalizedMessage(normalized, { customerName });
		}
	});

	return sock;
}