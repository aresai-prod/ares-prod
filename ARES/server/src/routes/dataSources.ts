import { Router } from "express";
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
    return res.json(pod.dataSources);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load data sources." });
  }
});

router.put("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const payload = req.body as {
    localSql?: { connectionString?: string };
    postgres?: { connectionString?: string };
    mysql?: { connectionString?: string };
    firebase?: { projectId?: string; serviceAccountJson?: string };
  };

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canEditPod(user, podId)) {
      return res.status(403).json({ error: "No edit access to pod." });
    }
    const now = new Date().toISOString();
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) => {
        if (pod.id !== podId) return pod;
        return {
          ...pod,
          dataSources: {
            localSql: {
              connectionString: payload.localSql?.connectionString ?? pod.dataSources.localSql.connectionString,
              updatedAt: now
            },
            postgres: {
              connectionString:
                payload.postgres?.connectionString ?? pod.dataSources.postgres?.connectionString ?? "",
              updatedAt: now
            },
            mysql: {
              connectionString:
                payload.mysql?.connectionString ?? pod.dataSources.mysql?.connectionString ?? "",
              updatedAt: now
            },
            firebase: {
              projectId: payload.firebase?.projectId ?? pod.dataSources.firebase.projectId,
              serviceAccountJson:
                payload.firebase?.serviceAccountJson ?? pod.dataSources.firebase.serviceAccountJson,
              updatedAt: now
            }
          }
        };
      }),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.dataSources);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to save data sources." });
  }
});

export default router;
