import express from "express";
import dotenv from "dotenv";
import whatsappRouter from "./routes/whatsapp";
import dashboardRouter from "./routes/dashboard";
import cors from "cors";
import { startGmailPubSubListener } from "./gmail/pubsub-listener";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({
        status: "ok",
        service: "port 3001 The Final Odyssey"
    });
});

app.use("/webhook/whatsapp", whatsappRouter);
app.use("/api/dashboard", dashboardRouter);

const PORT = process.env.PORT || 3001;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`A Final Odyssey running on port ${PORT}`);

    // Must run in-process: Gmail ingestion shares the same in-memory
    // conversation/case/handoff stores that the dashboard API reads from.
    startGmailPubSubListener();
});