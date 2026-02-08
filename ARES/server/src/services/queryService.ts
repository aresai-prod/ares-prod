import type { DataSources, DataSourceKey } from "../models/types.js";
import { runLocalSqlQuery } from "../connectors/localSql.js";
import { runFirebaseQuery } from "../connectors/firebase.js";

export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

export type QueryContext = {
  dataSource: DataSourceKey;
  dataSources: DataSources;
};

export async function runQuery(sql: string, ctx: QueryContext): Promise<QueryResult> {
  if (ctx.dataSource === "localSql") {
    const connectionString = ctx.dataSources.localSql.connectionString;
    if (!connectionString) {
      throw new Error("Local SQL connection string not configured.");
    }
    return runLocalSqlQuery(connectionString, sql);
  }

  if (ctx.dataSource === "postgres") {
    const connectionString = ctx.dataSources.postgres?.connectionString ?? "";
    if (!connectionString) {
      throw new Error("PostgreSQL connection string not configured.");
    }
    return runLocalSqlQuery(connectionString, sql);
  }

  if (ctx.dataSource === "mysql") {
    const connectionString = ctx.dataSources.mysql?.connectionString ?? "";
    if (!connectionString) {
      throw new Error("MySQL connection string not configured.");
    }
    return runLocalSqlQuery(connectionString, sql);
  }

  if (ctx.dataSource === "firebase") {
    const { projectId, serviceAccountJson } = ctx.dataSources.firebase;
    if (!projectId || !serviceAccountJson) {
      throw new Error("Firebase credentials not configured.");
    }
    return runFirebaseQuery(sql, { projectId, serviceAccountJson });
  }

  throw new Error("Unsupported data source.");
}
