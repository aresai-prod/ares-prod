import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profile.js";
import podRoutes from "./routes/pods.js";
import knowledgeRoutes from "./routes/knowledge.js";
import dataSourceRoutes from "./routes/dataSources.js";
import dashboardRoutes from "./routes/dashboards.js";
import knowledgeBankRoutes from "./routes/knowledgeBank.js";
import insightsRoutes from "./routes/insights.js";
import chatRoutes from "./routes/chat.js";
import analyticsRoutes from "./routes/analytics.js";
import feedbackRoutes from "./routes/feedback.js";
import connectorRoutes from "./routes/connectors.js";
import orgRoutes from "./routes/org.js";
import billingRoutes from "./routes/billing.js";
import adminRoutes from "./routes/admin.js";
import conciergeRoutes from "./routes/concierge.js";
import publicRoutes from "./routes/public.js";

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 8787;
const isDev = process.env.NODE_ENV !== "production";
const allowedOrigins = (process.env.CORS_ORIGIN ?? "https://aresai-production.web.app,https://aresai.web.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/healthz", (_req, res) => {
  res.status(200).send("ok");
});

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/pods", podRoutes);
app.use("/api/pods/:podId/knowledge", knowledgeRoutes);
app.use("/api/pods/:podId/data-sources", dataSourceRoutes);
app.use("/api/pods/:podId/dashboards", dashboardRoutes);
app.use("/api/pods/:podId/knowledge-bank", knowledgeBankRoutes);
app.use("/api/pods/:podId/insights", insightsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/connectors", connectorRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/concierge", conciergeRoutes);
app.use("/api/public", publicRoutes);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`ARES server running on port ${port}`);
});
