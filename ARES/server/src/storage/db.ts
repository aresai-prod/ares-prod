import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Database, Organization, PasswordReset, PublicUser, Session, UserRecord } from "../models/types.js";
import { getDefaultKnowledge } from "../services/defaults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "../../data/db.json");
const DB_DIR = path.dirname(DB_PATH);

function isLegacyKnowledgeSeed(knowledge: any): boolean {
  if (!knowledge) return false;
  const table = knowledge.tableDictionary?.[0];
  const column = knowledge.columnDictionary?.[0];
  const metric = knowledge.metrics?.[0];
  return (
    knowledge.tableDictionary?.length === 1 &&
    knowledge.columnDictionary?.length === 1 &&
    knowledge.metrics?.length === 1 &&
    table?.tableName === "orders" &&
    table?.description === "Customer orders" &&
    column?.tableName === "orders" &&
    column?.columnName === "order_id" &&
    column?.dataType === "uuid" &&
    column?.description === "Unique order id" &&
    metric?.name === "Monthly Revenue"
  );
}

function normalizeDefaultKnowledge(db: Database): Database {
  const emptyKnowledge = getDefaultKnowledge();
  let changed = false;
  const next = {
    ...db,
    orgs: db.orgs.map((org) => {
      const pods = org.pods.map((pod) => {
        const isLegacy =
          pod.knowledgeQuality?.notes === "Default knowledge seed." || isLegacyKnowledgeSeed(pod.knowledge);
        if (!isLegacy) return pod;
        changed = true;
        const { knowledgeQuality, ...rest } = pod;
        return {
          ...rest,
          knowledge: emptyKnowledge,
          knowledgeQuality: undefined
        };
      });
      return { ...org, pods };
    })
  };
  if (changed) {
    writeDb(next);
  }
  return next;
}

export function readDb(): Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const initial: Database = { users: [], orgs: [], sessions: [], passwordResets: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
  }
  let raw = fs.readFileSync(DB_PATH, "utf-8");
  if (!raw.trim()) {
    const initial: Database = { users: [], orgs: [], sessions: [], passwordResets: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    raw = JSON.stringify(initial);
  }
  let parsed: Database;
  try {
    parsed = JSON.parse(raw) as Database;
  } catch {
    const backupPath = `${DB_PATH}.corrupt.${Date.now()}`;
    fs.writeFileSync(backupPath, raw);
    const initial: Database = { users: [], orgs: [], sessions: [], passwordResets: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    parsed = initial;
  }
  if (!parsed.passwordResets) {
    parsed.passwordResets = [];
  }
  return normalizeDefaultKnowledge(parsed);
}

export function writeDb(db: Database): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const payload = JSON.stringify(db, null, 2);
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, payload);
  fs.renameSync(tmpPath, DB_PATH);
}

export function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, ...rest } = user;
  return rest;
}

export function findUserByEmail(db: Database, email: string): UserRecord | undefined {
  return db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
}

export function findUserById(db: Database, userId: string): UserRecord | undefined {
  return db.users.find((user) => user.id === userId);
}

export function findOrgById(db: Database, orgId: string): Organization | undefined {
  return db.orgs.find((org) => org.id === orgId);
}

export function addUser(user: UserRecord): PublicUser {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return sanitizeUser(user);
}

export function updateUser(userId: string, updater: (user: UserRecord) => UserRecord): UserRecord {
  const db = readDb();
  const idx = db.users.findIndex((user) => user.id === userId);
  if (idx === -1) {
    throw new Error("User not found");
  }
  const updated = updater(db.users[idx]);
  db.users[idx] = updated;
  writeDb(db);
  return updated;
}

export function addOrg(org: Organization): Organization {
  const db = readDb();
  db.orgs.push(org);
  writeDb(db);
  return org;
}

export function updateOrg(orgId: string, updater: (org: Organization) => Organization): Organization {
  const db = readDb();
  const idx = db.orgs.findIndex((org) => org.id === orgId);
  if (idx === -1) {
    throw new Error("Organization not found");
  }
  const updated = updater(db.orgs[idx]);
  db.orgs[idx] = updated;
  writeDb(db);
  return updated;
}

export function addSession(session: Session): void {
  const db = readDb();
  db.sessions.push(session);
  writeDb(db);
}

export function findSession(db: Database, sessionId: string): Session | undefined {
  return db.sessions.find((session) => session.id === sessionId);
}

export function removeSession(sessionId: string): void {
  const db = readDb();
  db.sessions = db.sessions.filter((session) => session.id !== sessionId);
  writeDb(db);
}

export function cleanupExpiredSessions(now: Date): void {
  const db = readDb();
  const filtered = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > now.getTime());
  if (filtered.length !== db.sessions.length) {
    db.sessions = filtered;
    writeDb(db);
  }
}

export function addPasswordReset(reset: PasswordReset): void {
  const db = readDb();
  db.passwordResets.push(reset);
  writeDb(db);
}

export function findPasswordReset(token: string): PasswordReset | undefined {
  const db = readDb();
  return db.passwordResets.find((entry) => entry.token === token);
}

export function markPasswordResetUsed(token: string): void {
  const db = readDb();
  db.passwordResets = db.passwordResets.map((entry) =>
    entry.token === token ? { ...entry, usedAt: new Date().toISOString() } : entry
  );
  writeDb(db);
}

export function purgePasswordResetsForUser(userId: string): void {
  const db = readDb();
  db.passwordResets = db.passwordResets.filter((entry) => entry.userId !== userId);
  writeDb(db);
}
