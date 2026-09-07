import { BusinessAction, BusinessDecision } from "./business-logic.service";
import { AIAnalysis } from "./ai.service";
import { createServiceCase } from "./case.service";
import { createHumanHandoff } from "./human-handoff.service";
import { generateResponse } from "./response.service";
import type { Channel } from "../types/communication";

export type ActionExecutionResult = {
    success: boolean;
    action: BusinessAction;
    message: string;
    data?: Record<string, unknown>;
};

export function executeBusinessAction(
    decision: BusinessDecision,
    analysis: AIAnalysis,
    customer: {
        conversationId: string;
        channel: Channel;
        name: string | null;
    }
): ActionExecutionResult {
    console.log("\n========== ACTION EXECUTOR ==========");

    switch (decision.action) {
        case "CREATE_CASE": {
            const serviceCase = createServiceCase(
                customer.conversationId,
                customer.channel,
                customer.name,
                analysis
            );

            console.log("Action: CREATE_CASE");
            console.log(
                "Service Case:",
                JSON.stringify(serviceCase, null, 2)
            );

            return {
                success: true,
                action: decision.action,
                message: "Service case created.",
                data: {
                    caseId: serviceCase.id,
                    status: serviceCase.status,
                },
            };
        }

        case "HANDOFF_TO_HUMAN": {
            const handoff = createHumanHandoff(
                customer.conversationId,
                customer.channel,
                customer.name,
                analysis
            );

            console.log("Action: HANDOFF_TO_HUMAN");
            console.log("Human Handoff:", handoff);

            return {
                success: true,
                action: decision.action,
                message: "Human handoff created.",
                data: {
                    handoffId: handoff.id,
                    status: handoff.status,
                },
            };
        }

        case "RESPOND": {
            const response = generateResponse(analysis);

            console.log("Action: RESPOND");
            console.log("Generated Response:", response);

            return {
                success: true,
                action: decision.action,
                message: "Response generated.",
                data: {
                    type: response.type,
                    text: response.text,
                },
            };
        }

        case "ASK_CLARIFICATION": {
            const response = generateResponse(analysis);

            console.log("Action: ASK_CLARIFICATION");
            console.log("Generated Clarification:", response);

            return {
                success: true,
                action: decision.action,
                message: "Clarification generated.",
                data: {
                    type: response.type,
                    text: response.text,
                },
            };
        }

        case "COLLECT_INFORMATION":
            console.log("Action: COLLECT_INFORMATION");

            return {
                success: true,
                action: decision.action,
                message: "Mock information collection started.",
                data: {
                    pendingAction: analysis.pending_action,
                },
            };

        case "WAIT":
            console.log("Action: WAIT");

            return {
                success: true,
                action: decision.action,
                message: "No immediate action required.",
            };

        case "NO_ACTION":
        default:
            console.log("Action: NO_ACTION");

            return {
                success: true,
                action: "NO_ACTION",
                message: "No business action required.",
            };
    }
}