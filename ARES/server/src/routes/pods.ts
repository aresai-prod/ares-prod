import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateOrg, updateUser } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canAdminPod, getPod, getUserAndOrg, getUserPodAccess, isOrgAdmin } from "../services/access.js";
import { createDefaultPod } from "../services/defaults.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { user, org } = getUserAndOrg(userId);
    const allowedPods = isOrgAdmin(user)
      ? org.pods
      : org.pods.filter((pod) => Boolean(getUserPodAccess(user, pod.id)));
    res.json({ pods: allowedPods, licenseType: org.license.tier });
  } catch (err) {
    return res.status(404).json({ error: err instanceof Error ? err.message : "Not found" });
  }
});

router.post("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { name } = req.body as { name?: string };
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Pod name must be at least 2 characters." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (org.accountType === "INDIVIDUAL" && org.pods.length >= 2) {
      return res.status(403).json({ error: "Individual license allows up to 2 pods." });
    }
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can create pods." });
    }

    const pod = createDefaultPod(name.trim());
    const updatedOrg = updateOrg(org.id, (current) => ({
      ...current,
      pods: [...current.pods, pod],
      updatedAt: new Date().toISOString()
    }));

    updateUser(userId, (current) => ({
      ...current,
      podAccess: [...current.podAccess, { podId: pod.id, role: "admin" }]
    }));

    return res.json({ pods: updatedOrg.pods });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to create pod." });
  }
});

router.delete("/:podId", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params;
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canAdminPod(user, podId)) {
      return res.status(403).json({ error: "Only pod admins can delete pods." });
    }
    updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.filter((pod) => pod.id !== podId),
      updatedAt: new Date().toISOString()
    }));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to delete pod." });
  }
});

router.get("/:podId", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params;
  try {
    const { user, org } = getUserAndOrg(userId);
    const access = getUserPodAccess(user, podId);
    if (!access) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    return res.json(pod);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load pod." });
  }
});

export default router;
