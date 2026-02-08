import { Router } from "express";
import { updateOrg } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canAdminPod, canEditPod, canViewPod, getPod, getUserAndOrg } from "../services/access.js";
import { evaluateKnowledgeQuality } from "../services/llmService.js";

const router = Router({ mergeParams: true });

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
    const chatOverride = pod.chatOverride ?? false;
    const chatEnabled =
      org.accountType !== "BUSINESS" ||
      chatOverride ||
      quality === null ||
      quality.score >= 80;
    return res.json({ quality, chatEnabled, chatOverride, threshold: 80 });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load quality." });
  }
});

router.post("/quality", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (org.accountType !== "BUSINESS") {
      return res.status(403).json({ error: "Quality scoring is available for enterprise plans only." });
    }
    if (!canAdminPod(user, podId)) {
      return res.status(403).json({ error: "Only admins can evaluate quality." });
    }
    const pod = getPod(org, podId);
    const provider = user.profile?.llmProvider;
    const apiKey = user.profile?.apiKey;
    const result = await evaluateKnowledgeQuality(pod.knowledge, {
      provider,
      apiKey,
      knowledgeBank: pod.knowledgeBank
    });
    const now = new Date().toISOString();
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((entry) => {
        if (entry.id !== podId) return entry;
        const chatOverride = entry.chatOverride ?? false;
        const chatEnabled = chatOverride || result.score >= 80;
        return {
          ...entry,
          knowledgeQuality: {
            score: result.score,
            notes: result.notes,
            updatedAt: now,
            evaluatedBy: "admin"
          },
          chatEnabled,
          chatOverride
        };
      }),
      updatedAt: now
    }));
    const updatedPod = updated.pods.find((entry) => entry.id === podId);
    return res.json({
      quality: updatedPod?.knowledgeQuality ?? null,
      chatEnabled: updatedPod?.chatEnabled ?? true,
      chatOverride: updatedPod?.chatOverride ?? false,
      threshold: 80
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Quality evaluation failed." });
  }
});

router.post("/chat-override", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const { enabled } = req.body as { enabled?: boolean };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (org.accountType !== "BUSINESS") {
      return res.status(403).json({ error: "Chat override is only available for enterprise plans." });
    }
    if (!canAdminPod(user, podId)) {
      return res.status(403).json({ error: "Only admins can override chat gating." });
    }
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((entry) =>
        entry.id === podId
          ? { ...entry, chatEnabled: Boolean(enabled), chatOverride: true }
          : entry
      ),
      updatedAt: new Date().toISOString()
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json({
      chatEnabled: pod?.chatEnabled ?? true,
      chatOverride: pod?.chatOverride ?? false
    });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update override." });
  }
});

export default router;
