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
import {
	isStaffNumber,
	getStaffName,
	isStaffName,
	getStaffNameByName,
} from "../services/staff-contacts.service";

const AUTH_FOLDER = path.join(__dirname, "..", "..", "auth_info");

let isReconnecting = false;

const groupNameCache = new Map<string, string>();

async function getGroupSubject(
	sock: WASocket,
	jid: string
): Promise<string | null> {
	if (groupNameCache.has(jid)) {
		return groupNameCache.get(jid) ?? null;
	}

	try {
		const metadata = await sock.groupMetadata(jid);
		const subject = metadata.subject || null;

		if (subject) {
			groupNameCache.set(jid, subject);
		}

		return subject;
	} catch (err) {
		console.error(
			"Failed to fetch group metadata for",
			jid,
			err
		);

		return null;
	}
}

function extractText(msg: any): string | null {
	const m = msg.message;

	if (!m) return null;

	if (m.conversation) {
		return m.conversation;
	}

	if (m.extendedTextMessage?.text) {
		return m.extendedTextMessage.text;
	}

	if (m.imageMessage?.caption) {
		return `[image] ${m.imageMessage.caption}`;
	}

	if (m.videoMessage?.caption) {
		return `[video] ${m.videoMessage.caption}`;
	}

	if (m.documentMessage) {
		return `[document] ${m.documentMessage.fileName || ""}`;
	}

	if (m.audioMessage) {
		return "[audio message]";
	}

	if (m.stickerMessage) {
		return "[sticker]";
	}

	return null;
}

function extractPhoneNumber(
	jid: string | null | undefined
): string | null {
	if (!jid) return null;

	const number = jid.split("@")[0];

	if (!number) return null;

	return number.replace(/\D/g, "") || null;
}

async function resolveSenderPhone(
	sock: WASocket,
	groupJid: string,
	senderJid: string,
	isGroup: boolean,
	participantAlt?: string | null
): Promise<string | null> {
	if (senderJid.endsWith("@s.whatsapp.net")) {
		return extractPhoneNumber(senderJid);
	}

	if (
		participantAlt &&
		participantAlt.endsWith("@s.whatsapp.net")
	) {
		const phone =
			extractPhoneNumber(participantAlt);

		if (phone) {
			return phone;
		}
	}

	if (isGroup && senderJid.endsWith("@lid")) {
		try {
			const metadata =
				await sock.groupMetadata(groupJid);

			const participant =
				metadata.participants.find(
					(item) =>
						item.id === senderJid ||
						item.lid === senderJid
				);

			if (participant?.phoneNumber) {
				return extractPhoneNumber(
					participant.phoneNumber
				);
			}
		} catch (err) {
			console.error(
				"Failed to resolve WhatsApp LID:",
				{
					groupJid,
					senderJid,
					error: err,
				}
			);
		}
	}

	return null;
}

export async function startBaileysWhatsApp(): Promise<WASocket> {
	await restoreAuthFolder(AUTH_FOLDER);

	const { state, saveCreds } =
		await useMultiFileAuthState(AUTH_FOLDER);

	let version: [number, number, number] = [
		2,
		3000,
		1015901307,
	];

	try {
		const fetched =
			await fetchLatestBaileysVersion();

		version = fetched.version;
	} catch {
		console.log(
			"Could not fetch latest Baileys version, using fallback."
		);
	}

	const sock = makeWASocket({
		version,
		auth: state,
		logger: pino({ level: "silent" }) as any,
		printQRInTerminal: false,
	});

	sock.ev.on("creds.update", async () => {
		await saveCreds();

		if (sock.authState.creds.registered) {
			await backupAuthFolder(AUTH_FOLDER).catch(
				(err) =>
					console.error(
						"Failed to backup WhatsApp auth to DB:",
						err
					)
			);
		}
	});

	if (!sock.authState.creds.registered) {
		const phoneNumber =
			process.env.WHATSAPP_PHONE_NUMBER;

		if (!phoneNumber) {
			console.error(
				"WHATSAPP_PHONE_NUMBER env var is not set. Set it (e.g. 66812345678, no + or spaces) to get a pairing code."
			);
		} else {
			setTimeout(async () => {
				try {
					const code =
						await sock.requestPairingCode(
							phoneNumber
						);

					console.log(
						"\n========== WHATSAPP PAIRING CODE =========="
					);
					console.log(`Code: ${code}`);
					console.log(
						"On your phone: WhatsApp → Settings → Linked Devices"
					);
					console.log(
						"→ Link a Device → Link with phone number instead"
					);
					console.log(
						"=============================================\n"
					);
				} catch (err) {
					console.error(
						"Failed to request pairing code:",
						err
					);
				}
			}, 3000);
		}
	}

	sock.ev.on("connection.update", (update) => {
		const {
			connection,
			lastDisconnect,
		} = update;

		if (connection === "open") {
			console.log(
				"✓ WhatsApp (Baileys) connected"
			);

			setComponentHealthy("whatsapp");

			backupAuthFolder(AUTH_FOLDER).catch(
				(err) =>
					console.error(
						"Failed to backup WhatsApp auth to DB:",
						err
					)
			);
		}

		if (connection === "close") {
			const statusCode =
				(lastDisconnect?.error as any)
					?.output?.statusCode;

			const loggedOut =
				statusCode === DisconnectReason.loggedOut;

			if (loggedOut) {
				console.log(
					"WhatsApp session logged out. Clear the whatsapp_auth row in Postgres and restart to re-link."
				);

				setComponentOffline(
					"whatsapp",
					"logged_out"
				);
			} else if (!isReconnecting) {
				isReconnecting = true;

				console.log(
					"WhatsApp connection closed, reconnecting in 3s…"
				);

				setComponentError(
					"whatsapp",
					lastDisconnect?.error ??
					"connection closed"
				);

				setTimeout(() => {
					startBaileysWhatsApp()
						.catch((err) =>
							console.error(
								"Failed to reconnect WhatsApp:",
								err
							)
						)
						.finally(() => {
							isReconnecting = false;
						});
				}, 3000);
			} else {
				console.log(
					"Reconnect already in progress, ignoring extra close event."
				);
			}
		}
	});

	sock.ev.on(
		"messages.upsert",
		async ({ messages, type }) => {
			if (type !== "notify") return;

			for (const msg of messages) {
				try {
					if (!msg.message) continue;

					const jid = msg.key.remoteJid;

					if (
						!jid ||
						jid === "status@broadcast"
					) {
						continue;
					}

					const text = extractText(msg);

					if (text === null) continue;

					const isGroup =
						jid.endsWith("@g.us");

					const waId =
						jid.split("@")[0] ?? jid;

					const senderJid = isGroup
						? (msg.key.participant ?? jid)
						: jid;

					const senderNumber =
						extractPhoneNumber(
							senderJid
						);

					const isFromMe =
						!!msg.key.fromMe;

					const pushName =
						msg.pushName?.trim() || null;

					let resolvedPhone =
						await resolveSenderPhone(
							sock,
							jid,
							senderJid,
							isGroup,
							msg.key.participantAlt
						);

					if (!resolvedPhone) {
						resolvedPhone =
							senderNumber;
					}

					const isStaffByPhone =
						!isFromMe &&
						!!resolvedPhone &&
						(await isStaffNumber(
							resolvedPhone
						));

					const isStaffByName =
						!isFromMe &&
						!!pushName &&
						(await isStaffName(
							pushName
						));

					const isOtherStaff =
						isStaffByPhone ||
						isStaffByName;

					const isStaff =
						isFromMe || isOtherStaff;

					const role:
						| "customer"
						| "cirrus" = isStaff
							? "cirrus"
							: "customer";

					let staffName: string | null =
						null;

					if (
						isStaffByPhone &&
						resolvedPhone
					) {
						staffName =
							await getStaffName(
								resolvedPhone
							);
					} else if (
						isStaffByName &&
						pushName
					) {
						staffName =
							await getStaffNameByName(
								pushName
							);
					}

					const senderDisplayName =
						isFromMe
							? "You"
							: isStaff
								? staffName ||
								pushName ||
								senderNumber ||
								senderJid
								: pushName ||
								senderNumber ||
								senderJid;

					console.log(
						"[WHATSAPP ROLE CHECK]",
						{
							jid,
							senderJid,
							participantAlt:
								msg.key
									.participantAlt ??
								null,
							pushName,
							senderNumber,
							resolvedPhone,
							isFromMe,
							isStaffByPhone,
							isStaffByName,
							isOtherStaff,
							isStaff,
							role,
							senderDisplayName,
						}
					);

					const conversationTitle =
						isGroup
							? await getGroupSubject(
								sock,
								jid
							)
							: isStaff
								? undefined
								: senderDisplayName;

					const normalized =
						normalizeWhatsAppMessage({
							messageId:
								msg.key.id ??
								`baileys-${Date.now()}`,

							waId,

							from: isStaff
								? "cirrus"
								: resolvedPhone ??
								senderNumber ??
								senderJid,

							text,

							timestamp: String(
								msg.messageTimestamp ??
								Math.floor(
									Date.now() / 1000
								)
							),

							groupId: isGroup
								? jid
								: null,

							senderName:
								senderDisplayName,
						});

					recordActivity({
						channel: "whatsapp",

						type: isStaff
							? "whatsapp_sent"
							: "whatsapp_received",

						conversationId:
							normalized.conversationId,

						customerName:
							conversationTitle ?? null,

						status: "success",

						message: isStaff
							? "WhatsApp staff message received"
							: "WhatsApp customer message received",
					});

					await ingestNormalizedMessage(
						normalized,
						{
							customerName:
								conversationTitle,
							role,
						}
					);
				} catch (err) {
					console.error(
						"Failed to process WhatsApp message (ignored, service stays up):",
						err
					);
				}
			}
		}
	);

	return sock;
}