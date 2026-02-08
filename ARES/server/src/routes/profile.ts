import { Router } from "express";
import { readDb, sanitizeUser, updateUser } from "../storage/db.js";
import type { DataSourceKey, LlmProvider } from "../models/types.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const db = readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  res.json(sanitizeUser(user));
});

router.put("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { llmProvider, apiKey, name, email, activeDataSource } = req.body as {
    llmProvider?: LlmProvider;
    apiKey?: string;
    name?: string;
    email?: string;
    activeDataSource?: DataSourceKey;
  };

  if (llmProvider && !["OPENAI", "GEMINI"].includes(llmProvider)) {
    return res.status(400).json({ error: "LLM provider must be OPENAI or GEMINI." });
  }

  if (activeDataSource && !["localSql", "firebase", "postgres", "mysql"].includes(activeDataSource)) {
    return res.status(400).json({ error: "Data source must be localSql, postgres, mysql, or firebase." });
  }

  const updated = updateUser(userId, (user) => ({
    ...user,
    name: name ?? user.name,
    email: email ? email.toLowerCase() : user.email,
    profile: {
      ...user.profile,
      llmProvider: llmProvider ?? user.profile.llmProvider,
      apiKey: apiKey ?? user.profile.apiKey,
      activeDataSource: activeDataSource ?? user.profile.activeDataSource,
      updatedAt: new Date().toISOString()
    }
  }));

  return res.json(sanitizeUser(updated));
});

export default router;
