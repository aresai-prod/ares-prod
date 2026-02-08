import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { addUser, readDb, sanitizeUser, updateUser } from "../storage/db.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { getUserAndOrg, isOrgAdmin } from "../services/access.js";
import { hashPassword } from "../services/authService.js";
import { getDefaultProfile } from "../services/defaults.js";
import type { OrgRole, PodAccess } from "../models/types.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { org } = getUserAndOrg(userId);
    return res.json(org);
  } catch (err) {
    return res.status(404).json({ error: err instanceof Error ? err.message : "Org not found." });
  }
});

router.get("/users", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can manage users." });
    }
    const db = readDb();
    const users = db.users.filter((entry) => entry.orgId === org.id).map(sanitizeUser);
    return res.json({ users });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to load users." });
  }
});

router.post("/users", requireAuth, async (req, res) => {
  const { userId } = req as AuthRequest;
  const { email, name, role, podAccess } = req.body as {
    email?: string;
    name?: string;
    role?: OrgRole;
    podAccess?: PodAccess[];
  };

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can add users." });
    }
    if (org.accountType !== "BUSINESS") {
      return res.status(403).json({ error: "Team management is available for Business accounts only." });
    }

    const db = readDb();
    if (db.users.find((entry) => entry.email === email.toLowerCase())) {
      return res.status(409).json({ error: "User already exists." });
    }

    const tempPassword = uuidv4().slice(0, 8);
    const passwordHash = await hashPassword(tempPassword);
    const now = new Date().toISOString();

    const finalRole = role ?? "user";
    const defaultAccessRole = finalRole === "admin" ? "admin" : "viewer";
    const newUser = {
      id: uuidv4(),
      orgId: org.id,
      email: email.toLowerCase(),
      name: name ?? email,
      licenseType: org.license.tier,
      passwordHash,
      authProvider: "password" as const,
      role: finalRole,
      podAccess: podAccess ?? org.pods.map((pod) => ({ podId: pod.id, role: defaultAccessRole })),
      profile: getDefaultProfile(),
      conversations: [],
      analytics: [],
      feedback: [],
      flags: {},
      createdAt: now
    };

    addUser(newUser);
    return res.json({ user: sanitizeUser(newUser), tempPassword });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to add user." });
  }
});

router.put("/users/:targetUserId", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const { targetUserId } = req.params as { targetUserId: string };
  const { role, podAccess } = req.body as { role?: OrgRole; podAccess?: PodAccess[] };

  try {
    const { user, org } = getUserAndOrg(userId);
    if (!isOrgAdmin(user)) {
      return res.status(403).json({ error: "Only admins can update users." });
    }

    const updated = updateUser(targetUserId, (current) => ({
      ...current,
      role: role ?? current.role,
      podAccess: podAccess ?? current.podAccess
    }));

    if (updated.orgId !== org.id) {
      return res.status(403).json({ error: "User does not belong to your org." });
    }

    return res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Unable to update user." });
  }
});

export default router;
