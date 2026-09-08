import path from "path";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";

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

	sock.ev.on("connection.update", (update) => {
		const { connection, lastDisconnect, qr } = update;

		if (qr) {
			console.log("\n========== SCAN THIS QR WITH WHATSAPP ==========");
			qrcodeTerminal.generate(qr, { small: true });
			console.log("WhatsApp → Settings → Linked Devices → Link a Device");
			console.log("=================================================\n");
		}

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
					"WhatsApp session logged out. Delete backend/auth_info/ and restart to re-link."
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