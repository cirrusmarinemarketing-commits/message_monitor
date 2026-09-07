import express from "express";

import {
	clearConversation,
} from "../services/conversation.service";

import {
	clearConversationBuffer,
} from "../services/conversation.buffer.service";

import { ingestNormalizedMessage } from "../services/pipeline.service";
import { normalizeWhatsAppMessage } from "../whatsapp/normalizer";
import { recordActivity } from "../services/activity.service";
import { setComponentHealthy, setComponentError } from "../services/system-status.service";

const router = express.Router();

router.get("/", (req, res) => {
	const mode = req.query["hub.mode"];
	const token =
		req.query["hub.verify_token"];
	const challenge =
		req.query["hub.challenge"];

	const verifyToken =
		process.env.WHATSAPP_VERIFY_TOKEN;

	if (
		mode === "subscribe" &&
		token === verifyToken
	) {
		console.log(
			"WhatsApp webhook verified"
		);

		return res
			.status(200)
			.send(challenge);
	}

	return res.sendStatus(403);
});

router.post("/", async (req, res) => {
	try {
		// Respond immediately to WhatsApp
		res.sendStatus(200);

		const body = req.body;

		console.log(
			"\n========== WHATSAPP WEBHOOK =========="
		);

		console.log(
			JSON.stringify(
				body,
				null,
				2
			)
		);

		if (
			body?.object !==
			"whatsapp_business_account"
		) {
			return;
		}

		const entries =
			body?.entry ?? [];

		for (const entry of entries) {
			const changes =
				entry?.changes ?? [];

			for (const change of changes) {
				const value =
					change?.value;

				const messages =
					value?.messages ?? [];

				if (
					messages.length === 0
				) {
					continue;
				}

				const contacts =
					value?.contacts ?? [];

				const contact =
					contacts[0];

				const waId: string | null =
					contact?.wa_id ??
					null;

				const customerName: string | null =
					contact?.profile?.name ??
					null;

				if (!waId) {
					console.log(
						"Customer WhatsApp ID is missing"
					);

					continue;
				}

				for (
					const messageData
					of messages
				) {
					const messageText =
						messageData?.text
							?.body ?? null;

					if (!messageText) {
						console.log(
							"Non-text message received:",
							messageData?.type
						);

						continue;
					}

					const normalized = normalizeWhatsAppMessage({
						messageId:
							messageData?.id ??
							`wa-${Date.now()}`,
						waId,
						from:
							messageData?.from ??
							waId,
						text: messageText,
						timestamp:
							messageData
								?.timestamp ??
							new Date().toISOString(),
					});

					recordActivity({
						channel: "whatsapp",
						type: "whatsapp_received",
						conversationId: waId,
						customerName,
						status: "success",
						message: "WhatsApp message received",
					});

					ingestNormalizedMessage(
						normalized,
						{ customerName }
					);
				}
			}
		}

		setComponentHealthy("whatsapp");
	} catch (error) {
		console.error(
			"WhatsApp webhook error:",
			error
		);

		setComponentError("whatsapp", error);

		recordActivity({
			channel: "whatsapp",
			type: "processing_error",
			conversationId: null,
			customerName: null,
			status: "error",
			message:
				error instanceof Error ? error.message : String(error),
		});
	}
});

router.post(
	"/test",
	async (req, res) => {
		try {
			const {
				wa_id,
				name,
				message,
				waitForCompletion = false,
			} = req.body;

			if (
				!wa_id ||
				!message
			) {
				return res
					.status(400)
					.json({
						error:
							"wa_id and message are required",
					});
			}

			const normalized = normalizeWhatsAppMessage({
				messageId:
					`test-${Date.now()}-${Math.random()
						.toString(36)
						.slice(2, 8)}`,
				waId: wa_id,
				from: wa_id,
				text: message,
				timestamp:
					new Date().toISOString(),
			});

			recordActivity({
				channel: "whatsapp",
				type: "whatsapp_received",
				conversationId: wa_id,
				customerName: name ?? null,
				status: "success",
				message: "WhatsApp test message received",
			});

			setComponentHealthy("whatsapp");

			const completion =
				ingestNormalizedMessage(
					normalized,
					{
						customerName: name ?? null,
						waitForCompletion,
					}
				);

			if (
				waitForCompletion &&
				completion
			) {
				const analysis =
					await completion;

				return res
					.status(200)
					.json({
						success: true,
						status:
							"completed",
						analysis,
					});
			}

			return res
				.status(200)
				.json({
					success: true,
					status:
						"accepted",
					message:
						"Message added to conversation buffer",
				});
		} catch (error) {
			console.error(
				"Test message error:",
				error
			);

			return res
				.status(500)
				.json({
					error:
						"Test message failed",
				});
		}
	}
);

router.post(
	"/test/clear",
	(req, res) => {
		try {
			const {
				wa_id,
			} = req.body;

			if (!wa_id) {
				return res
					.status(400)
					.json({
						error:
							"wa_id is required",
					});
			}

			clearConversationBuffer(
				wa_id
			);

			clearConversation(
				wa_id
			);

			return res
				.status(200)
				.json({
					success: true,
					message:
						"Conversation and buffer cleared",
				});
		} catch (error) {
			console.error(
				"Clear conversation error:",
				error
			);

			return res
				.status(500)
				.json({
					error:
						"Failed to clear conversation",
				});
		}
	}
);

export default router;
