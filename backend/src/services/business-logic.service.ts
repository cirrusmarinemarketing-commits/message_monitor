import { AIAnalysis } from "./ai.service";

export type BusinessAction =
	| "RESPOND"
	| "ASK_CLARIFICATION"
	| "HANDOFF_TO_HUMAN"
	| "COLLECT_INFORMATION"
	| "CREATE_CASE"
	| "WAIT"
	| "NO_ACTION";

export type BusinessDecision = {
	action: BusinessAction;
	reason: string;
	data: {
		createCase: boolean;
		handoff: boolean;
		needsResponse: boolean;
		needsClarification: boolean;
	};
};

function resolveServiceRequest(
	analysis: AIAnalysis
): BusinessAction {
	if (analysis.intent !== "service_request") {
		return analysis.action as BusinessAction;
	}

	if (analysis.action !== "CREATE_CASE") {
		return analysis.action as BusinessAction;
	}

	/*
	 * AI may classify a service inquiry as CREATE_CASE.
	 * Check the customer's actual wording across multiple fields.
	 */
	const text = [
		analysis.request,
		analysis.customer_position,
		analysis.summary,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();

	const inquiryPatterns = [
		"do you",
		"can you",
		"would you",
		"are you able",
		"do you specialise",
		"do you specialize",
		"specialise in",
		"specialize in",
		"provide this",
		"provide this service",
		"offer this",
		"รับงาน",
		"รับทำ",
		"ทำได้ไหม",
		"รับติดตั้งไหม",
		"รับติดตั้งหรือไม่",
		"มีบริการ",
		"ให้บริการ",
	];

	const isServiceInquiry = inquiryPatterns.some(
		(pattern) => text.includes(pattern)
	);

	if (isServiceInquiry) {
		return "RESPOND";
	}

	return "CREATE_CASE";
}

export function processBusinessLogic(
	analysis: AIAnalysis
): BusinessDecision {
	const action = resolveServiceRequest(analysis);

	switch (action) {
		case "CREATE_CASE":
			return {
				action,
				reason:
					"Customer has a service request that requires operational action.",
				data: {
					createCase: true,
					handoff: false,
					needsResponse: false,
					needsClarification: false,
				},
			};

		case "HANDOFF_TO_HUMAN":
			return {
				action,
				reason:
					"Customer explicitly requires human assistance.",
				data: {
					createCase: false,
					handoff: true,
					needsResponse: false,
					needsClarification: false,
				},
			};

		case "ASK_CLARIFICATION":
			return {
				action,
				reason:
					"The request cannot be processed without additional information.",
				data: {
					createCase: false,
					handoff: false,
					needsResponse: true,
					needsClarification: true,
				},
			};

		case "RESPOND":
			return {
				action,
				reason:
					"Customer request can be handled through a normal response.",
				data: {
					createCase: false,
					handoff: false,
					needsResponse: true,
					needsClarification: false,
				},
			};

		case "COLLECT_INFORMATION":
			return {
				action,
				reason:
					"Additional information should be collected before continuing.",
				data: {
					createCase: false,
					handoff: false,
					needsResponse: true,
					needsClarification: true,
				},
			};

		case "WAIT":
			return {
				action,
				reason:
					"No immediate operational action is required.",
				data: {
					createCase: false,
					handoff: false,
					needsResponse: false,
					needsClarification: false,
				},
			};

		case "NO_ACTION":
		default:
			return {
				action: "NO_ACTION",
				reason: "No business action is required.",
				data: {
					createCase: false,
					handoff: false,
					needsResponse: false,
					needsClarification: false,
				},
			};
	}
}