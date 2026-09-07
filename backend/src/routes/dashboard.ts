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

router.get("/overview", (_req, res) => {
    res.json({
        success: true,
        data: getDashboardOverview(),
    });
});

router.get("/conversations", (_req, res) => {
    res.json({
        success: true,
        data: getDashboardConversations(),
    });
});

router.get("/conversations/:conversationId", (req, res) => {
    const conversation =
        getDashboardConversation(req.params.conversationId);

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

router.get("/cases", (_req, res) => {
    res.json({
        success: true,
        data: getDashboardCases(),
    });
});

router.get("/handoffs", (_req, res) => {
    res.json({
        success: true,
        data: getDashboardHandoffs(),
    });
});

router.get("/activity", (req, res) => {
    const limit = Number(req.query.limit);

    res.json({
        success: true,
        data: getDashboardActivity(
            Number.isFinite(limit) && limit > 0 ? limit : undefined
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