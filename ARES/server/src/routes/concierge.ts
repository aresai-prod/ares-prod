import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getUserAndOrg } from "../services/access.js";
import { canUseTokens, consumeTokens, estimateTokens } from "../services/billingService.js";
import { generateSupportResponse } from "../services/llmService.js";
import { updateOrg } from "../storage/db.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { message, history } = req.body as {
    message?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  let user;
  let org;
  try {
    const ctx = getUserAndOrg(userId);
    user = ctx.user;
    org = ctx.org;
  } catch (err) {
    return res.status(404).json({ error: "User not found." });
  }

  const hasProviderKey =
    user.profile.apiKey ||
    (user.profile.llmProvider === "OPENAI" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY);
  if (!hasProviderKey) {
    return res
      .status(400)
      .json({ error: "Add your OpenAI or Gemini API key in Profile to enable concierge." });
  }

  const estimated = estimateTokens(message);
  if (!canUseTokens(org, estimated)) {
    return res.status(402).json({ error: "Token limit reached. Upgrade your license to continue." });
  }

  try {
    const result = await generateSupportResponse({
      message,
      history: history ?? [],
      provider: user.profile.llmProvider,
      apiKey: user.profile.apiKey,
      accountType: org.accountType,
      licenseTier: org.license.tier
    });

    const updatedOrg = consumeTokens(org, result.tokensUsed);
    updateOrg(org.id, () => updatedOrg);

    return res.json({ reply: result.reply });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : "Concierge failed.";
    if (messageText.toLowerCase().includes("api key")) {
      return res.status(400).json({ error: "Invalid OpenAI/Gemini API key. Update it in Profile." });
    }
    return res.status(500).json({ error: messageText });
  }
});

export default router;
