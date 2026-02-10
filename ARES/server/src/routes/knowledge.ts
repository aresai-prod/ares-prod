import { Router } from "express";
import { updateOrg } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canAdminPod, canEditPod, canViewPod, getPod, getUserAndOrg } from "../services/access.js";
import { evaluateKnowledgeQuality } from "../services/llmService.js";
import type { KnowledgeBase, KnowledgeBankEntry } from "../models/types.js";

const router = Router({ mergeParams: true });

function estimateQualityFallback(knowledge: KnowledgeBase, bank: KnowledgeBankEntry[]): { score: number; notes: string } {
  const tables = knowledge.tableDictionary ?? [];
  const columns = knowledge.columnDictionary ?? [];
  const metrics = knowledge.metrics ?? [];
  const params = knowledge.parameters ?? {
    dateHandlingRules: "",
    bestQueryPractices: "",
    businessContext: "",
    sampleQueries: []
  };

  const tableComplete = tables.filter((entry) => entry.tableName?.trim() && entry.description?.trim()).length;
  const columnComplete = columns.filter(
    (entry) => entry.tableName?.trim() && entry.columnName?.trim() && entry.dataType?.trim() && entry.description?.trim()
  ).length;
  const tableScore = Math.min(30, (tableComplete / Math.max(1, tables.length)) * 30);
  const columnScore = Math.min(20, (columnComplete / Math.max(1, columns.length)) * 20);

  const paramsScore =
    [
      params.dateHandlingRules?.trim(),
      params.bestQueryPractices?.trim(),
      params.businessContext?.trim(),
      params.sampleQueries?.length ? "ok" : ""
    ].filter(Boolean).length * 5;

  const metricFields = metrics.length * 4;
  const metricFilled = metrics.reduce((total, metric) => {
    return (
      total +
      (metric.name?.trim() ? 1 : 0) +
      (metric.definition?.trim() ? 1 : 0) +
      (metric.sampleQuery?.trim() ? 1 : 0) +
      (metric.defaultFilters?.trim() ? 1 : 0)
    );
  }, 0);
  const metricScore = metricFields ? (metricFilled / metricFields) * 20 : 0;
  const bankScore = bank.length > 0 ? 10 : 0;

  const score = Math.max(0, Math.min(100, Math.round(tableScore + columnScore + paramsScore + metricScore + bankScore)));
  return { score, notes: "Evaluated using local scoring fallback." };
}

function normalizeScore(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

router.get("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    return res.json(pod.knowledge);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load knowledge." });
  }
});

router.put("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const knowledge = req.body;
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canEditPod(user, podId)) {
      return res.status(403).json({ error: "No edit access to pod." });
    }
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) => (pod.id === podId ? { ...pod, knowledge } : pod)),
      updatedAt: new Date().toISOString()
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.knowledge ?? knowledge);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to save knowledge." });
  }
});

router.get("/quality", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    const quality = pod.knowledgeQuality ?? null;
    return res.json({ quality, chatEnabled: true, chatOverride: false, threshold: 0 });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load quality." });
  }
});

router.post("/quality", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    const heuristic = estimateQualityFallback(pod.knowledge, pod.knowledgeBank ?? []);
    const provider = user.profile?.llmProvider;
    const apiKey = user.profile?.apiKey;
    let result: { score: number; notes: string };
    try {
      const llmResult = await evaluateKnowledgeQuality(pod.knowledge, {
        provider,
        apiKey,
        knowledgeBank: pod.knowledgeBank
      });
      result = {
        score: normalizeScore(llmResult.score, heuristic.score),
        notes: llmResult.notes?.trim() ? llmResult.notes : heuristic.notes
      };
    } catch {
      result = heuristic;
    }
    const now = new Date().toISOString();
    const evaluatedQuality = {
      score: result.score,
      notes: result.notes,
      updatedAt: now,
      evaluatedBy: "admin" as const
    };
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((entry) => {
        if (entry.id !== podId) return entry;
        return {
          ...entry,
          knowledgeQuality: evaluatedQuality,
          chatEnabled: true,
          chatOverride: false
        };
      }),
      updatedAt: now
    }));
    const updatedPod = updated.pods.find((entry) => entry.id === podId) ?? pod;
    return res.json({
      quality: updatedPod.knowledgeQuality ?? evaluatedQuality,
      chatEnabled: true,
      chatOverride: false,
      threshold: 0
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Quality evaluation failed." });
  }
});

router.post("/chat-override", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (org.accountType !== "BUSINESS") {
      return res.status(403).json({ error: "Chat override is only available for enterprise plans." });
    }
    if (!canAdminPod(user, podId)) {
      return res.status(403).json({ error: "Only admins can override chat gating." });
    }
    updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((entry) =>
        entry.id === podId
          ? { ...entry, chatEnabled: true, chatOverride: false }
          : entry
      ),
      updatedAt: new Date().toISOString()
    }));
    return res.json({
      chatEnabled: true,
      chatOverride: false
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update override." });
  }
});

export default router;
