import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  addOrg,
  addPasswordReset,
  addSession,
  addUser,
  findOrgById,
  findPasswordReset,
  findUserByEmail,
  purgePasswordResetsForUser,
  readDb,
  removeSession,
  sanitizeUser,
  updateUser,
  markPasswordResetUsed
} from "../storage/db.js";
import { createSession, hashPassword, signToken, verifyPassword } from "../services/authService.js";
import { createDefaultPod, getDefaultProfile } from "../services/defaults.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import {
  getGoogleAuthUrl,
  getGoogleProfile,
  getGoogleProfileFromAccessToken,
  getGoogleProfileFromIdToken
} from "../services/googleAuth.js";
import { createLicense } from "../services/billingService.js";
import type { Organization, UserRecord } from "../models/types.js";

const router = Router();

function getAppOrigins(): string[] {
  const fallback = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174";
  const raw = process.env.APP_ORIGIN ?? fallback;
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeRedirect(raw: string | undefined): string {
  const appOrigins = getAppOrigins();
  const defaultOrigin = appOrigins[0];
  if (!raw) return defaultOrigin;
  try {
    const url = new URL(raw);
    if (process.env.NODE_ENV !== "production") {
      return url.origin;
    }
    if (!appOrigins.includes(url.origin)) return defaultOrigin;
    return url.origin;
  } catch {
    return defaultOrigin;
  }
}

function createIndividualOrg(ownerName: string): Organization {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: `${ownerName}'s Workspace`,
    accountType: "INDIVIDUAL",
    license: createLicense("INDIVIDUAL", "FREE"),
    pods: [createDefaultPod("Default Pod")],
    createdAt: now,
    updatedAt: now
  };
}

function createUserForOrg(org: Organization, user: Partial<UserRecord> & { email: string; passwordHash: string }): UserRecord {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    orgId: org.id,
    email: user.email.toLowerCase(),
    name: user.name ?? "ARES User",
    licenseType: org.license.tier,
    passwordHash: user.passwordHash,
    authProvider: user.authProvider ?? "password",
    role: user.role ?? "admin",
    podAccess: org.pods.map((pod) => ({ podId: pod.id, role: "admin" })),
    profile: getDefaultProfile(),
    conversations: [],
    analytics: [],
    feedback: [],
    flags: {},
    createdAt: now
  };
}

async function upsertGoogleUser(profile: { email: string; name: string }) {
  const db = readDb();
  let user = findUserByEmail(db, profile.email);

  if (!user) {
    const org = createIndividualOrg(profile.name);
    addOrg(org);
    const passwordHash = await hashPassword(uuidv4());
    user = createUserForOrg(org, {
      email: profile.email,
      name: profile.name,
      passwordHash,
      authProvider: "google",
      role: "admin"
    });
    addUser(user);
  }

  const org = findOrgById(readDb(), user.orgId);
  if (!org) {
    throw new Error("org_missing");
  }

  const session = createSession(user.id);
  addSession(session);
  const token = signToken(user, session);

  return { token, user: sanitizeUser(user) };
}

router.post("/signup", async (req, res) => {
  const { email, name, password } = req.body as {
    email?: string;
    name?: string;
    password?: string;
  };

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const normalizedEmail = email.toLowerCase();

  const db = readDb();
  if (findUserByEmail(db, normalizedEmail)) {
    return res.status(409).json({ error: "User already exists." });
  }

  const passwordHash = await hashPassword(password);
  const org = createIndividualOrg(name ?? "ARES User");
  addOrg(org);

  const userRecord = createUserForOrg(org, {
    email: normalizedEmail,
    name: name ?? "ARES User",
    passwordHash,
    authProvider: "password",
    role: "admin"
  });
  addUser(userRecord);

  const session = createSession(userRecord.id);
  addSession(session);
  const token = signToken(userRecord, session);

  return res.json({ token, user: sanitizeUser(userRecord) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const normalizedEmail = email.toLowerCase();

  const db = readDb();
  const user = findUserByEmail(db, normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const session = createSession(user.id);
  addSession(session);
  const token = signToken(user, session);
  updateUser(user.id, (current) => ({ ...current, lastLoginAt: new Date().toISOString() }));

  return res.json({ token, user: sanitizeUser(user) });
});

router.post("/forgot", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }
  const normalizedEmail = email.toLowerCase();
  const db = readDb();
  const user = findUserByEmail(db, normalizedEmail);

  if (!user) {
    return res.json({ ok: true });
  }

  const token = uuidv4();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
  addPasswordReset({
    id: uuidv4(),
    userId: user.id,
    token,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString()
  });

  const isDev = process.env.NODE_ENV !== "production";
  return res.json({ ok: true, ...(isDev ? { resetToken: token } : {}) });
});

router.post("/reset", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    return res.status(400).json({ error: "Token and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const reset = findPasswordReset(token);
  if (!reset || reset.usedAt) {
    return res.status(400).json({ error: "Reset token is invalid." });
  }
  if (new Date(reset.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: "Reset token expired." });
  }

  const passwordHash = await hashPassword(password);
  updateUser(reset.userId, (current) => ({ ...current, passwordHash }));
  markPasswordResetUsed(token);
  purgePasswordResetsForUser(reset.userId);

  return res.json({ ok: true });
});

router.get("/google/start", (req, res) => {
  const redirectBase = normalizeRedirect(req.query.redirect as string | undefined);
  try {
    const url = getGoogleAuthUrl(redirectBase);
    return res.redirect(url);
  } catch (err) {
    return res.redirect(`${redirectBase}/auth/callback?error=google_not_configured`);
  }
});

router.get("/google/status", (_req, res) => {
  const enabled = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
  return res.json({ enabled });
});

router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const accessToken = (req.query.access_token as string | undefined) ?? (req.query.accessToken as string | undefined);
  const idToken = (req.query.id_token as string | undefined) ?? (req.query.idToken as string | undefined);
  const redirectBase = normalizeRedirect(state);
  if (!code && !accessToken && !idToken) {
    return res.redirect(`${redirectBase}/auth/callback?error=missing_code`);
  }

  try {
    if (idToken) {
      const profile = await getGoogleProfileFromIdToken(idToken);
      const result = await upsertGoogleUser(profile);
      return res.redirect(`${redirectBase}/auth/callback?token=${encodeURIComponent(result.token)}`);
    }

    if (accessToken) {
      const profile = await getGoogleProfileFromAccessToken(accessToken);
      const result = await upsertGoogleUser(profile);
      return res.redirect(`${redirectBase}/auth/callback?token=${encodeURIComponent(result.token)}`);
    }

    if (!code) {
      return res.redirect(`${redirectBase}/auth/callback?error=missing_code`);
    }
    const profile = await getGoogleProfile(code);
    const result = await upsertGoogleUser(profile);
    return res.redirect(`${redirectBase}/auth/callback?token=${encodeURIComponent(result.token)}`);
  } catch (err) {
    return res.redirect(`${redirectBase}/auth/callback?error=google_auth_failed`);
  }
});

router.post("/google/token", async (req, res) => {
  const { accessToken, idToken } = req.body as { accessToken?: string | null; idToken?: string | null };
  if (!accessToken && !idToken) {
    return res.status(400).json({ error: "Missing Google token payload." });
  }

  try {
    if (idToken) {
      const profile = await getGoogleProfileFromIdToken(idToken);
      const result = await upsertGoogleUser(profile);
      return res.json(result);
    }

    if (accessToken) {
      const profile = await getGoogleProfileFromAccessToken(accessToken);
      const result = await upsertGoogleUser(profile);
      return res.json(result);
    }

    return res.status(400).json({ error: "Invalid Google token payload." });
  } catch (err) {
    return res.status(401).json({ error: "Google token exchange failed." });
  }
});

router.get("/me", requireAuth, (req, res) => {
  const { userId } = req as AuthRequest;
  const db = readDb();
  const user = db.users.find((entry) => entry.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }
  return res.json({ user: sanitizeUser(user) });
});

router.post("/logout", requireAuth, (req, res) => {
  const { sessionId } = req as AuthRequest;
  if (sessionId) removeSession(sessionId);
  return res.json({ ok: true });
});

export default router;
