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
const defaultCorsOrigins = "https://aresai-production.web.app,https://aresai.web.app";
const alwaysAllowedOrigins = [
  "https://aresai-production.web.app",
  "https://aresai.web.app",
  "https://aresai-production.firebaseapp.com",
  "https://aresai.firebaseapp.com"
];

function normalizeOriginValue(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin.toLowerCase();
  } catch {
    return null;
  }
}

const allowedOriginEntries = Array.from(
  new Set(
    `${defaultCorsOrigins},${process.env.CORS_ORIGIN ?? ""},${alwaysAllowedOrigins.join(",")}`
      .split(",")
      .map((origin) => normalizeOriginValue(origin))
      .filter((origin): origin is string => Boolean(origin))
  )
).map((origin) => ({
  origin,
  hostname: new URL(origin).hostname.toLowerCase()
}));

const allowedHostnames = new Set(allowedOriginEntries.map((entry) => entry.hostname));
const allowedHostnameSuffixes = Array.from(allowedHostnames).map((hostname) => `.${hostname}`);

function isAllowedOrigin(origin: string): boolean {
  const normalized = normalizeOriginValue(origin);
  if (!normalized) return false;
  const hostname = new URL(normalized).hostname.toLowerCase();
  if (allowedHostnames.has(hostname)) return true;
  if (allowedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))) return true;
  return allowedOriginEntries.some((allowed) => allowed.origin === normalized);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isDev) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(null, false);
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
