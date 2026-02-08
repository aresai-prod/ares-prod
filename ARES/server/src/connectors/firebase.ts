import * as admin from "firebase-admin";
import type { QueryResult } from "../services/queryService.js";

export type FirebaseConfig = {
  projectId: string;
  serviceAccountJson: string;
};

type FirestoreQuery = {
  collection: string;
  fields: string[] | null;
  filters: Array<{ field: string; op: "=="; value: string | number | boolean }>;
  orderBy?: { field: string; direction: "asc" | "desc" };
  limit?: number;
};

const appCache = new Map<string, admin.app.App>();

function getAppKey(config: FirebaseConfig): string {
  return `${config.projectId}-${Buffer.from(config.serviceAccountJson).toString("base64").slice(0, 12)}`;
}

function getFirestore(config: FirebaseConfig): admin.firestore.Firestore {
  const key = getAppKey(config);
  let app = appCache.get(key);
  if (!app) {
    const serviceAccount = JSON.parse(config.serviceAccountJson) as admin.ServiceAccount;
    app = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccount),
        projectId: config.projectId
      },
      key
    );
    appCache.set(key, app);
  }
  return app.firestore();
}

function parseValue(raw: string): string | number | boolean {
  const trimmed = raw.trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
}

function parseSql(sql: string): FirestoreQuery {
  const selectMatch = sql.match(/select\s+(.+?)\s+from\s+([a-zA-Z0-9_\-]+)/i);
  if (!selectMatch) {
    throw new Error("Only basic SELECT queries are supported for Firebase.");
  }

  const fieldsRaw = selectMatch[1].trim();
  const collection = selectMatch[2].trim();
  const fields = fieldsRaw === "*" ? null : fieldsRaw.split(",").map((f) => f.trim());

  const whereMatch = sql.match(/where\s+(.+?)(order\s+by|limit|$)/i);
  const filters: FirestoreQuery["filters"] = [];
  if (whereMatch) {
    const conditions = whereMatch[1].split(/\s+and\s+/i);
    for (const condition of conditions) {
      const match = condition.match(/([a-zA-Z0-9_\.\-]+)\s*=\s*([^\n\r]+)/);
      if (match) {
        filters.push({
          field: match[1].trim(),
          op: "==",
          value: parseValue(match[2])
        });
      }
    }
  }

  const orderMatch = sql.match(/order\s+by\s+([a-zA-Z0-9_\.\-]+)(\s+desc|\s+asc)?/i);
  const orderBy = orderMatch
    ? {
        field: orderMatch[1].trim(),
        direction: (orderMatch[2]?.trim().toLowerCase() === "desc" ? "desc" : "asc") as "asc" | "desc"
      }
    : undefined;

  const limitMatch = sql.match(/limit\s+(\d+)/i);
  const limit = limitMatch ? Number(limitMatch[1]) : undefined;

  return { collection, fields, filters, orderBy, limit };
}

export async function testFirebaseConnection(config: FirebaseConfig): Promise<boolean> {
  const firestore = getFirestore(config);
  await firestore.listCollections();
  return true;
}

export async function runFirebaseQuery(sql: string, config: FirebaseConfig): Promise<QueryResult> {
  const firestore = getFirestore(config);
  const parsed = parseSql(sql);
  let query: admin.firestore.Query = firestore.collection(parsed.collection);

  for (const filter of parsed.filters) {
    query = query.where(filter.field, filter.op, filter.value);
  }
  if (parsed.orderBy) {
    query = query.orderBy(parsed.orderBy.field, parsed.orderBy.direction);
  }
  if (parsed.limit) {
    query = query.limit(parsed.limit);
  }

  const snapshot = await query.get();
  const rows = snapshot.docs.map((doc) => {
    const data = doc.data();
    if (!parsed.fields) {
      return { id: doc.id, ...data } as Record<string, string | number | boolean | null>;
    }
    const row: Record<string, string | number | boolean | null> = {};
    parsed.fields.forEach((field) => {
      row[field] = (data as Record<string, any>)[field] ?? null;
    });
    return row;
  });

  const columns = parsed.fields ?? (rows.length > 0 ? Object.keys(rows[0]) : []);
  return { columns, rows };
}
