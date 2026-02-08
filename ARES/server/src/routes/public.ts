import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const contactFile = path.join(dataDir, "contact-submissions.json");
const analyticsFile = path.join(dataDir, "website-analytics.json");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readList(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return [];
  try {
    return JSON.parse(raw) as any[];
  } catch {
    return [];
  }
}

function writeList(filePath: string, entries: any[]) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(entries, null, 2));
  fs.renameSync(tempPath, filePath);
}

router.post("/contact", (req, res) => {
  const { name, email, company, message } = req.body as {
    name?: string;
    email?: string;
    company?: string;
    message?: string;
  };

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: "name, email and message are required." });
  }

  ensureDataDir();
  const entries = readList(contactFile);
  entries.push({
    id: uuidv4(),
    name,
    email,
    company: company ?? "",
    message,
    receivedAt: new Date().toISOString()
  });
  writeList(contactFile, entries);

  return res.json({ ok: true });
});

router.post("/analytics", (req, res) => {
  const { event, payload, ts } = req.body as {
    event?: string;
    payload?: Record<string, unknown>;
    ts?: string;
  };

  if (!event) {
    return res.status(400).json({ ok: false, error: "event is required." });
  }

  ensureDataDir();
  const entries = readList(analyticsFile);
  entries.push({
    id: uuidv4(),
    event,
    payload: payload ?? {},
    ts: ts ?? new Date().toISOString(),
    receivedAt: new Date().toISOString()
  });
  writeList(analyticsFile, entries);

  return res.json({ ok: true });
});

export default router;
