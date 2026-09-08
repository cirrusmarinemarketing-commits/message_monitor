import { Router } from "express";

import {
    getDashboardOverview,
    getDashboardConversations,
    getDashboardConversation,
    getDashboardCases,
    getDashboardHandoffs,
    getDashboardActivity,
    getDashboardHealth,
} from "../services/router.service";

const router = Router();

router.get("/overview", async (_req, res) => {
    res.json({
        success: true,
        data: await getDashboardOverview(),
    });
});

router.get("/conversations", async (_req, res) => {
    res.json({
        success: true,
        data: await getDashboardConversations(),
    });
});

router.get("/conversations/:conversationId", async (req, res) => {
    const channel =
        req.query.channel === "email" ||
            req.query.channel === "whatsapp"
            ? req.query.channel
            : undefined;

    const conversation =
        await getDashboardConversation(
            req.params.conversationId,
            channel
        );

    if (!conversation) {
        return res.status(404).json({
            success: false,
            error: "Conversation not found",
        });
    }

    res.json({
        success: true,
        data: conversation,
    });
});

router.get("/cases", async (_req, res) => {
    res.json({
        success: true,
        data: await getDashboardCases(),
    });
});

router.get("/handoffs", async (_req, res) => {
    res.json({
        success: true,
        data: await getDashboardHandoffs(),
    });
});

router.get("/activity", (req, res) => {
    const limit = Number(req.query.limit);

    res.json({
        success: true,
        data: getDashboardActivity(
            Number.isFinite(limit) && limit > 0
                ? limit
                : undefined
        ),
    });
});

router.get("/health", (_req, res) => {
    res.json({
        success: true,
        data: getDashboardHealth(),
    });
});

export default router;