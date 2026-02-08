import { runLocalSqlQuery, testLocalSqlConnection } from "./localSql.js";
import type { QueryResult } from "../services/queryService.js";

function assertPostgres(connectionString: string): void {
  if (!connectionString.startsWith("postgres://") && !connectionString.startsWith("postgresql://")) {
    throw new Error("PostgreSQL connection string must start with postgres:// or postgresql://");
  }
}

export async function testPostgresConnection(connectionString: string): Promise<boolean> {
  assertPostgres(connectionString);
  return testLocalSqlConnection({ connectionString });
}

export async function runPostgresQuery(connectionString: string, sql: string): Promise<QueryResult> {
  assertPostgres(connectionString);
  return runLocalSqlQuery(connectionString, sql);
}
