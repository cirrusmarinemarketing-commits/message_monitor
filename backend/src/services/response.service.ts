import { AIAnalysis } from "./ai.service";

export type ResponseType =
    | "RESPONSE"
    | "CLARIFICATION";

export type GeneratedResponse = {
    type: ResponseType;
    text: string;
};

export function generateResponse(
    analysis: AIAnalysis
): GeneratedResponse {

    if (analysis.action === "ASK_CLARIFICATION") {
        return {
            type: "CLARIFICATION",
            text: generateClarification(analysis),
        };
    }

    return {
        type: "RESPONSE",
        text: generateResponseText(analysis),
    };
}

function generateClarification(
    analysis: AIAnalysis
): string {

    if (analysis.intent === "needs_clarification") {
        return "ได้ครับ รบกวนแจ้งรายละเอียดเพิ่มเติมว่าต้องการให้ทางเราช่วยเรื่องใดครับ";
    }

    if (analysis.pending_action) {
        return `รบกวนแจ้งข้อมูลเพิ่มเติมเกี่ยวกับ ${analysis.pending_action} ครับ`;
    }

    return "ได้ครับ รบกวนแจ้งรายละเอียดเพิ่มเติมเพื่อให้ทางเราช่วยตรวจสอบได้ครับ";
}

function generateResponseText(
    analysis: AIAnalysis
): string {

    switch (analysis.intent) {

        case "quotation_request":
            return "ได้ครับ รับทราบคำขอใบเสนอราคาแล้วครับ";

        case "parts_inquiry":
            return "ได้ครับ รับทราบคำถามเรื่องอะไหล่แล้วครับ";

        case "service_request":
            if (analysis.action === "RESPOND") {
                return "ได้ครับ รับทราบคำถามเกี่ยวกับบริการของทางเราครับ";
            }

            return "ได้ครับ รับทราบรายละเอียดงานบริการแล้วครับ";

        case "refund_request":
            return "ได้ครับ รับทราบคำขอคืนเงินแล้วครับ";

        case "payment_inquiry":
            return "ได้ครับ รับทราบปัญหาเกี่ยวกับ invoice แล้วครับ";

        case "follow_up":
            return "ได้ครับ รับทราบคำขอติดตามเรื่องแล้วครับ";

        case "technical_support":
            return "ได้ครับ รับทราบปัญหาทางเทคนิคแล้วครับ";

        case "complaint":
            return "รับทราบครับ ทางเราเข้าใจข้อกังวลของคุณครับ";

        case "normal_chat":
            return "ยินดีครับ 😊";

        case "general_inquiry":
            return "ได้ครับ รับทราบคำถามแล้วครับ";

        default:
            return "รับทราบครับ";
    }
}