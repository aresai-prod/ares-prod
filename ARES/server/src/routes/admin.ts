import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { addOrg, addUser, findUserByEmail, readDb, updateUser } from "../storage/db.js";
import { createDefaultPod, getDefaultProfile } from "../services/defaults.js";
import { createLicense } from "../services/billingService.js";
import { hashPassword } from "../services/authService.js";

const router = Router();

function requireAdminKey(req: any, res: any, next: any) {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: "Invalid admin key." });
  }
  return next();
}

router.post("/whitelist", requireAdminKey, (req, res) => {
  const { email, whitelisted } = req.body as { email?: string; whitelisted?: boolean };
  if (!email) {
    return res.status(400).json({ error: "email is required." });
  }
  const db = readDb();
  const user = findUserByEmail(db, email);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  const updated = updateUser(user.id, (current) => ({
    ...current,
    flags: {
      ...current.flags,
      whitelisted: whitelisted ?? true
    }
  }));
  return res.json({ user: updated });
});

router.post("/create-business", requireAdminKey, async (req, res) => {
  const { orgName, adminEmail, adminName, password } = req.body as {
    orgName?: string;
    adminEmail?: string;
    adminName?: string;
    password?: string;
  };

  if (!orgName || !adminEmail || !password) {
    return res.status(400).json({ error: "orgName, adminEmail, and password are required." });
  }

  const db = readDb();
  if (findUserByEmail(db, adminEmail)) {
    return res.status(409).json({ error: "User already exists." });
  }

  const now = new Date().toISOString();
  const org = {
    id: uuidv4(),
    name: orgName,
    accountType: "BUSINESS" as const,
    license: createLicense("BUSINESS", "BUSINESS"),
    pods: [createDefaultPod("Main Pod")],
    createdAt: now,
    updatedAt: now
  };

  addOrg(org);

  const passwordHash = await hashPassword(password);
  const adminUser = {
    id: uuidv4(),
    orgId: org.id,
    email: adminEmail.toLowerCase(),
    name: adminName ?? "Business Admin",
    licenseType: org.license.tier,
    passwordHash,
    authProvider: "password" as const,
    role: "admin" as const,
    podAccess: org.pods.map((pod) => ({ podId: pod.id, role: "admin" as const })),
    profile: getDefaultProfile(),
    conversations: [],
    analytics: [],
    feedback: [],
    flags: { whitelisted: true },
    createdAt: now
  };

  addUser(adminUser);
  return res.json({ org, adminUser });
});

export default router;
