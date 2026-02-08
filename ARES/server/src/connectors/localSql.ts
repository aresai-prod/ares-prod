import { Pool as PgPool } from "pg";
import mysql, { type FieldPacket } from "mysql2/promise";
import type { QueryResult } from "../services/queryService.js";

export type LocalSqlConfig = {
  connectionString: string;
};

const pgPools = new Map<string, PgPool>();
const mysqlPools = new Map<string, mysql.Pool>();

function getProtocol(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    return url.protocol.replace(":", "");
  } catch {
    return "";
  }
}

function getPgPool(connectionString: string): PgPool {
  let pool = pgPools.get(connectionString);
  if (!pool) {
    pool = new PgPool({ connectionString });
    pgPools.set(connectionString, pool);
  }
  return pool;
}

function getMysqlPool(connectionString: string): mysql.Pool {
  let pool = mysqlPools.get(connectionString);
  if (!pool) {
    pool = mysql.createPool({ uri: connectionString, connectionLimit: 4 });
    mysqlPools.set(connectionString, pool);
  }
  return pool;
}

export async function testLocalSqlConnection(config: LocalSqlConfig): Promise<boolean> {
  const protocol = getProtocol(config.connectionString);
  if (protocol === "postgres" || protocol === "postgresql") {
    const pool = getPgPool(config.connectionString);
    await pool.query("SELECT 1");
    return true;
  }
  if (protocol === "mysql" || protocol === "mysql2") {
    const pool = getMysqlPool(config.connectionString);
    await pool.query("SELECT 1");
    return true;
  }
  throw new Error("Unsupported SQL protocol. Use postgres:// or mysql://");
}

export async function runLocalSqlQuery(connectionString: string, sql: string): Promise<QueryResult> {
  const protocol = getProtocol(connectionString);
  if (protocol === "postgres" || protocol === "postgresql") {
    const pool = getPgPool(connectionString);
    const result = await pool.query(sql);
    const columns = result.fields.map((field) => field.name);
    return { columns, rows: result.rows };
  }

  if (protocol === "mysql" || protocol === "mysql2") {
    const pool = getMysqlPool(connectionString);
    const [rows, fields] = await pool.query(sql);
    const columns = Array.isArray(fields) ? fields.map((field: FieldPacket) => field.name) : [];
    return { columns, rows: rows as Array<Record<string, string | number | boolean | null>> };
  }

  throw new Error("Unsupported SQL protocol. Use postgres:// or mysql://");
}
