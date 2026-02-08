import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateOrg } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canEditPod, canViewPod, getPod, getUserAndOrg } from "../services/access.js";

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
    return res.json(pod.knowledgeBank);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load knowledge bank." });
  }
});

router.post("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const { title, date, highlights, lowlights, docText } = req.body as {
    title?: string;
    date?: string;
    highlights?: string;
    lowlights?: string;
    docText?: string;
  };

  if (!title || !date || !highlights || !lowlights) {
    return res.status(400).json({ error: "title, date, highlights, and lowlights are required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canEditPod(user, podId)) {
      return res.status(403).json({ error: "No edit access to pod." });
    }
    const now = new Date().toISOString();
    const entry = {
      id: uuidv4(),
      title,
      date,
      highlights,
      lowlights,
      docText,
      createdAt: now,
      createdBy: userId
    };
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) =>
        pod.id === podId
          ? { ...pod, knowledgeBank: [...pod.knowledgeBank, entry] }
          : pod
      ),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.knowledgeBank ?? []);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to save knowledge bank entry." });
  }
});

export default router;
