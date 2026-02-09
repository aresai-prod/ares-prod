import fs from "fs";
import path from "path";
import { Pool, type PoolClient } from "pg";
import { fileURLToPath } from "url";
import type { Database, Organization, PasswordReset, PublicUser, Session, UserRecord } from "../models/types.js";
import { getDefaultKnowledge } from "../services/defaults.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, "../../data/db.json");
const DB_DIR = path.dirname(DB_PATH);

const EMPTY_DB: Database = { users: [], orgs: [], sessions: [], passwordResets: [] };
const APP_DATABASE_URL =
  process.env.ARES_APP_DATABASE_URL ??
  process.env.APP_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "";
const USE_POSTGRES_STORE = /^postgres(?:ql)?:\/\//i.test(APP_DATABASE_URL);

function shouldUseSsl(connectionString: string): boolean {
  if (!connectionString) return false;
  if (process.env.ARES_APP_DB_SSL === "disable") return false;
  try {
    const hostname = new URL(connectionString).hostname;
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return true;
  }
}

const pgPool = USE_POSTGRES_STORE
  ? new Pool({
      connectionString: APP_DATABASE_URL,
      ssl: shouldUseSsl(APP_DATABASE_URL) ? { rejectUnauthorized: false } : false
    })
  : null;

type StorageBackend = "file" | "postgres";
let backend: StorageBackend = "file";
let dbCache: Database = EMPTY_DB;
let persistQueue: Promise<void> = Promise.resolve();

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ensureDbShape(db: Database): Database {
  const safe = db ?? deepClone(EMPTY_DB);
  return {
    users: Array.isArray(safe.users) ? safe.users : [],
    orgs: Array.isArray(safe.orgs) ? safe.orgs : [],
    sessions: Array.isArray(safe.sessions) ? safe.sessions : [],
    passwordResets: Array.isArray(safe.passwordResets) ? safe.passwordResets : []
  };
}

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

function writeFileStore(db: Database): void {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  const payload = JSON.stringify(db, null, 2);
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, payload);
  fs.renameSync(tmpPath, DB_PATH);
}

function readFileStore(): Database {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    writeFileStore(EMPTY_DB);
  }
  let raw = fs.readFileSync(DB_PATH, "utf-8");
  if (!raw.trim()) {
    writeFileStore(EMPTY_DB);
    raw = JSON.stringify(EMPTY_DB);
  }
  try {
    return ensureDbShape(JSON.parse(raw) as Database);
  } catch {
    const backupPath = `${DB_PATH}.corrupt.${Date.now()}`;
    fs.writeFileSync(backupPath, raw);
    writeFileStore(EMPTY_DB);
    return deepClone(EMPTY_DB);
  }
}

async function ensurePgTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ares_app_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ares_users (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      license_type TEXT NOT NULL,
      auth_provider TEXT,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ares_orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      account_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ares_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ares_password_resets (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function syncDerivedPgTables(client: PoolClient, state: Database): Promise<void> {
  await client.query("DELETE FROM ares_users");
  await client.query("DELETE FROM ares_orgs");
  await client.query("DELETE FROM ares_sessions");
  await client.query("DELETE FROM ares_password_resets");

  for (const org of state.orgs) {
    await client.query(
      `INSERT INTO ares_orgs (id, name, account_type, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [org.id, org.name, org.accountType, JSON.stringify(org)]
    );
  }

  for (const user of state.users) {
    await client.query(
      `INSERT INTO ares_users (id, org_id, email, name, role, license_type, auth_provider, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW())`,
      [
        user.id,
        user.orgId,
        user.email,
        user.name,
        user.role,
        user.licenseType,
        user.authProvider ?? "password",
        JSON.stringify(user)
      ]
    );
  }

  for (const session of state.sessions) {
    await client.query(
      `INSERT INTO ares_sessions (id, user_id, expires_at, payload, updated_at) VALUES ($1, $2, $3, $4::jsonb, NOW())`,
      [session.id, session.userId, session.expiresAt, JSON.stringify(session)]
    );
  }

  for (const reset of state.passwordResets) {
    await client.query(
      `INSERT INTO ares_password_resets (token, user_id, expires_at, used_at, payload, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW())`,
      [reset.token, reset.userId, reset.expiresAt, reset.usedAt ?? null, JSON.stringify(reset)]
    );
  }
}

async function persistToPostgres(state: Database): Promise<void> {
  if (!pgPool) return;
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    await ensurePgTables(client);
    await client.query(
      `
      INSERT INTO ares_app_state (id, data, updated_at)
      VALUES (1, $1::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `,
      [JSON.stringify(state)]
    );
    await syncDerivedPgTables(client, state);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
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

function parsePgData(raw: unknown): Database | null {
  if (!raw) return null;
  try {
    if (typeof raw === "string") {
      return ensureDbShape(JSON.parse(raw) as Database);
    }
    if (typeof raw === "object") {
      return ensureDbShape(raw as Database);
    }
    return null;
  } catch {
    return null;
  }
}

async function initStorage(): Promise<void> {
  const fileState = readFileStore();
  if (!pgPool) {
    backend = "file";
    dbCache = normalizeDefaultKnowledge(fileState);
    return;
  }

  try {
    const client = await pgPool.connect();
    try {
      await ensurePgTables(client);
      const result = await client.query("SELECT data FROM ares_app_state WHERE id = 1");
      if (result.rowCount === 0) {
        await client.query(
          `INSERT INTO ares_app_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW())`,
          [JSON.stringify(fileState)]
        );
        await syncDerivedPgTables(client, fileState);
        backend = "postgres";
        dbCache = normalizeDefaultKnowledge(fileState);
        return;
      }

      const parsed = parsePgData(result.rows[0]?.data) ?? fileState;
      backend = "postgres";
      dbCache = normalizeDefaultKnowledge(parsed);
      await syncDerivedPgTables(client, dbCache);
    } finally {
      client.release();
    }
  } catch (err) {
    backend = "file";
    dbCache = normalizeDefaultKnowledge(fileState);
    writeFileStore(dbCache);
    // eslint-disable-next-line no-console
    console.error("ARES storage fallback to file db.json:", err instanceof Error ? err.message : err);
  }
}

await initStorage();

function schedulePersist(next: Database): void {
  const snapshot = ensureDbShape(deepClone(next));
  dbCache = snapshot;

  if (backend === "postgres" && pgPool) {
    persistQueue = persistQueue
      .then(async () => {
        await persistToPostgres(snapshot);
        writeFileStore(snapshot);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("ARES Postgres persist failed:", err instanceof Error ? err.message : err);
        writeFileStore(snapshot);
      });
    return;
  }

  writeFileStore(snapshot);
}

export function readDb(): Database {
  const next = ensureDbShape(deepClone(dbCache));
  dbCache = next;
  return normalizeDefaultKnowledge(next);
}

export function writeDb(db: Database): void {
  schedulePersist(db);
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
