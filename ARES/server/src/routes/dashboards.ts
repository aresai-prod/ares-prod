import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { updateOrg } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { canEditPod, canViewPod, getPod, getUserAndOrg } from "../services/access.js";
import { collectChatTrends, runDashboardWidget } from "../services/dashboardService.js";

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
    return res.json(pod.dashboards);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load dashboards." });
  }
});

router.post("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const { name, description } = req.body as { name?: string; description?: string };
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Dashboard name is required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canEditPod(user, podId)) {
      return res.status(403).json({ error: "No edit access to pod." });
    }
    const now = new Date().toISOString();
    const dashboard = {
      id: uuidv4(),
      name: name.trim(),
      description,
      widgets: [],
      createdAt: now,
      updatedAt: now
    };
    const updated = updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) =>
        pod.id === podId ? { ...pod, dashboards: [...pod.dashboards, dashboard] } : pod
      ),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    return res.json(pod?.dashboards ?? []);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to create dashboard." });
  }
});

router.put("/:dashboardId", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId, dashboardId } = req.params as { podId: string; dashboardId: string };
  const { name, description, widgets } = req.body as {
    name?: string;
    description?: string;
    widgets?: any[];
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
          dashboards: pod.dashboards.map((dashboard) =>
            dashboard.id === dashboardId
              ? {
                  ...dashboard,
                  name: name ?? dashboard.name,
                  description: description ?? dashboard.description,
                  widgets: widgets ?? dashboard.widgets,
                  updatedAt: now
                }
              : dashboard
          )
        };
      }),
      updatedAt: now
    }));
    const pod = updated.pods.find((entry) => entry.id === podId);
    const dashboard = pod?.dashboards.find((entry) => entry.id === dashboardId);
    return res.json(dashboard);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update dashboard." });
  }
});

router.delete("/:dashboardId", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId, dashboardId } = req.params as { podId: string; dashboardId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canEditPod(user, podId)) {
      return res.status(403).json({ error: "No edit access to pod." });
    }
    updateOrg(org.id, (current) => ({
      ...current,
      pods: current.pods.map((pod) =>
        pod.id === podId
          ? { ...pod, dashboards: pod.dashboards.filter((entry) => entry.id !== dashboardId) }
          : pod
      ),
      updatedAt: new Date().toISOString()
    }));
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to delete dashboard." });
  }
});

router.post("/run", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  const { widget } = req.body as { widget: any };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    const result = await runDashboardWidget(widget, pod, {
      dataSource: user.profile.activeDataSource,
      dataSources: pod.dataSources
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to run widget." });
  }
});

router.get("/trends", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { podId } = req.params as { podId: string };
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!canViewPod(user, podId)) {
      return res.status(403).json({ error: "No access to pod." });
    }
    const pod = getPod(org, podId);
    const widgets = collectChatTrends(pod);
    const results = [] as Array<{ widgetId: string; title: string; chartType: string; data: any }>;
    for (const widget of widgets) {
      const data = await runDashboardWidget(widget, pod, {
        dataSource: user.profile.activeDataSource,
        dataSources: pod.dataSources
      });
      results.push({ widgetId: widget.id, title: widget.title, chartType: widget.chartType, data });
    }
    return res.json({ widgets: results });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load trends." });
  }
});

export default router;
