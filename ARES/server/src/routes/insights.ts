import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateOrg } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canViewPod, getPod, getUserAndOrg } from "../services/access.js";

const router = Router({ mergeParams: true });

function ensureBusiness(accountType: string): boolean {
  return accountType === "BUSINESS";
}

router.get("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!ensureBusiness(org.accountType)) {
      return res.status(403).json({ error: "Insights are available for Business accounts only." });
    }
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    return res.json(pod.insights);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load insights." });
  }
});

router.post("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const { content } = req.body as { content?: string };
  if (!content) {
    return res.status(400).json({ error: "content is required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!ensureBusiness(org.accountType)) {
      return res.status(403).json({ error: "Insights are available for Business accounts only." });
    }
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const now = new Date().toISOString();
    const post = {
      id: uuidv4(),
      userId,
      content,
      createdAt: now,
      likes: [],
      comments: []
    };
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) =>
        pod.id === podId ? { ...pod, insights: [post, ...pod.insights] } : pod
      ),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.insights ?? []);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to share insight." });
  }
});

router.post("/:insightId/like", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId, insightId } = req.params as { podId: string; insightId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!ensureBusiness(org.accountType)) {
      return res.status(403).json({ error: "Insights are available for Business accounts only." });
    }
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) => {
        if (pod.id !== podId) return pod;
        return {
          ...pod,
          insights: pod.insights.map((post) => {
            if (post.id !== insightId) return post;
            const liked = post.likes.includes(userId);
            return {
              ...post,
              likes: liked ? post.likes.filter((id) => id !== userId) : [...post.likes, userId]
            };
          })
        };
      }),
      updatedAt: new Date().toISOString()
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.insights ?? []);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to like insight." });
  }
});

router.post("/:insightId/comment", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId, insightId } = req.params as { podId: string; insightId: string };
  const { content } = req.body as { content?: string };
  if (!content) {
    return res.status(400).json({ error: "content is required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!ensureBusiness(org.accountType)) {
      return res.status(403).json({ error: "Insights are available for Business accounts only." });
    }
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const now = new Date().toISOString();
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) => {
        if (pod.id !== podId) return pod;
        return {
          ...pod,
          insights: pod.insights.map((post) =>
            post.id === insightId
              ? {
                  ...post,
                  comments: [...post.comments, { id: uuidv4(), userId, content, createdAt: now }]
                }
              : post
          )
        };
      }),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.insights ?? []);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to comment." });
  }
});

export default router;
