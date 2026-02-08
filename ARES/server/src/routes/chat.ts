import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateOrg, updateUser } from "../storage/db.js";
import { generateAnalysis, generateSql } from "../services/llmService.js";
import { runQuery } from "../services/queryService.js";
import { retrieveContext } from "../rag/ragService.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canViewPod, getPod, getUserAndOrg } from "../services/access.js";
import { canUseTokens, consumeTokens, estimateTokens } from "../services/billingService.js";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { message, conversationId, podId } = req.body as {
    message: string;
    conversationId?: string;
    podId?: string;
  };

  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: "Message is required." });
  }

  let org;
  let user;
  let pod;
  try {
    const ctx = getUserAndOrg(userId);
    user = ctx.user;
    org = ctx.org;
    const targetPodId = podId ?? user.podAccess[0]?.podId;
    if (!targetPodId) {
      return res.status(400).json({ error: "No pod selected." });
    }
    if (!canViewPod(user, targetPodId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    pod = getPod(org, targetPodId);
  } catch (err) {
    return res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }

  const knowledgeBankContext = pod.knowledgeBank
    .slice(-3)
    .map((entry) => `(${entry.date}) ${entry.title}: ${entry.highlights} | ${entry.lowlights}`)
    .join("\n");

  if (org.accountType === "BUSINESS") {
    const qualityScore = pod.knowledgeQuality?.score;
    const chatOverride = pod.chatOverride ?? false;
    const chatEnabled = chatOverride || qualityScore === undefined || qualityScore >= 80;
    if (!chatEnabled) {
      return res.status(403).json({
        error: "Chat is disabled until knowledge quality reaches 80. An admin can enable it in Knowledge settings."
      });
    }
  }

  const hasProviderKey =
    user.profile.apiKey ||
    (user.profile.llmProvider === "OPENAI"
      ? process.env.OPENAI_API_KEY
      : process.env.GEMINI_API_KEY);
  if (!hasProviderKey) {
    return res.status(400).json({
      error: "Add your OpenAI or Gemini API key in Profile to enable live SQL and analysis."
    });
  }

  const estimated = estimateTokens(
    `${message}${JSON.stringify(pod.knowledge)}${knowledgeBankContext}`
  );
  if (!canUseTokens(org, estimated)) {
    return res.status(402).json({ error: "Token limit reached. Upgrade your license to continue." });
  }

  const conversation =
    user.conversations.find((item) => item.id === conversationId) ??
    {
      id: conversationId ?? uuidv4(),
      podId: pod.id,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

  const userMessage = {
    id: uuidv4(),
    role: "user" as const,
    content: message,
    createdAt: new Date().toISOString()
  };
  conversation.messages.push(userMessage);

  let sqlResult;
  let queryResult;
  let analysisResult;

  try {
    const rag = await retrieveContext(message);
    const recentFeedback = user.feedback.slice(-3);

    sqlResult = await generateSql({
      message,
      provider: user.profile.llmProvider,
      apiKey: user.profile.apiKey,
      knowledge: pod.knowledge,
      dataSource: user.profile.activeDataSource,
      rag,
      feedback: recentFeedback,
      knowledgeBank: knowledgeBankContext,
      dashboards: pod.dashboards
    });

    queryResult = await runQuery(sqlResult.sql, {
      dataSource: user.profile.activeDataSource,
      dataSources: pod.dataSources
    });

    analysisResult = await generateAnalysis({
      message,
      sql: sqlResult.sql,
      columns: queryResult.columns,
      rows: queryResult.rows,
      provider: user.profile.llmProvider,
      apiKey: user.profile.apiKey,
      knowledge: pod.knowledge,
      dataSource: user.profile.activeDataSource,
      feedback: recentFeedback,
      knowledgeBank: knowledgeBankContext,
      dashboards: pod.dashboards
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Query failed." });
  }

  const tokensUsed = sqlResult.tokensUsed + analysisResult.tokensUsed;
  const updatedOrg = consumeTokens(org, tokensUsed);
  updateOrg(org.id, () => updatedOrg);

  const assistantMessage = {
    id: uuidv4(),
    role: "assistant" as const,
    content: analysisResult.analysis,
    createdAt: new Date().toISOString()
  };

  conversation.messages.push(assistantMessage);
  conversation.updatedAt = new Date().toISOString();

  updateUser(userId, (current) => {
    const existingIndex = current.conversations.findIndex((entry) => entry.id === conversation.id);
    const nextConversations = [...current.conversations];
    if (existingIndex >= 0) {
      nextConversations[existingIndex] = conversation;
    } else {
      nextConversations.push(conversation);
    }
    return { ...current, conversations: nextConversations };
  });

  return res.json({
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    sql: sqlResult.sql,
    analysis: analysisResult.analysis,
    chartHint: sqlResult.chartHint,
    columns: queryResult.columns,
    rows: queryResult.rows
  });
});

export default router;
