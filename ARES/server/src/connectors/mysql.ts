import { runLocalSqlQuery, testLocalSqlConnection } from "./localSql.js";
import type { QueryResult } from "../services/queryService.js";

function assertMysql(connectionString: string): void {
  if (!connectionString.startsWith("mysql://") && !connectionString.startsWith("mysql2://")) {
    throw new Error("MySQL connection string must start with mysql:// or mysql2://");
  }
}

export async function testMysqlConnection(connectionString: string): Promise<boolean> {
  assertMysql(connectionString);
  return testLocalSqlConnection({ connectionString });
}

export async function runMysqlQuery(connectionString: string, sql: string): Promise<QueryResult> {
  assertMysql(connectionString);
  return runLocalSqlQuery(connectionString, sql);
}
