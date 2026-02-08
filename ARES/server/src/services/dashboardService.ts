import type { DashboardWidget, MetricQuery, Pod } from "../models/types.js";
import type { QueryContext, QueryResult } from "./queryService.js";
import { runQuery } from "./queryService.js";

type SqlDialect = "postgres" | "mysql" | "generic";

function sanitizeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_\.]/g, "");
}

function detectDialect(ctx: QueryContext): SqlDialect {
  if (ctx.dataSource === "postgres") return "postgres";
  if (ctx.dataSource === "mysql") return "mysql";
  if (ctx.dataSource === "localSql") {
    const conn = ctx.dataSources.localSql?.connectionString ?? "";
    if (conn.startsWith("mysql://") || conn.startsWith("mysql2://")) return "mysql";
    if (conn.startsWith("postgres://") || conn.startsWith("postgresql://")) return "postgres";
  }
  return "generic";
}

function buildWhere(filters: MetricQuery["filters"], dialect: SqlDialect): string {
  if (!filters.length) return "";
  const clauses = filters.map((filter) => {
    const column = sanitizeIdentifier(filter.column);
    const raw = filter.value ?? "";
    const value = raw.replace(/'/g, "''");

    if (filter.op === "contains") {
      const comparator = dialect === "postgres" ? "ILIKE" : "LIKE";
      return `${column} ${comparator} '%${value}%'`;
    }

    if (filter.op === "in") {
      const list = filter.values ?? raw.split(",").map((item) => item.trim()).filter(Boolean);
      if (list.length === 0) {
        return "1=1";
      }
      const quoted = list.map((item) => `'${item.replace(/'/g, "''")}'`).join(", ");
      return `${column} IN (${quoted})`;
    }

    if (filter.op === "between") {
      const from = value;
      const to = (filter.valueTo ?? "").replace(/'/g, "''");
      if (!from || !to) {
        return "1=1";
      }
      return `${column} BETWEEN '${from}' AND '${to}'`;
    }

    return `${column} ${filter.op} '${value}'`;
  });
  return `WHERE ${clauses.join(" AND ")}`;
}

function buildJoins(joins: MetricQuery["joins"]): string {
  if (!joins.length) return "";
  return joins
    .map((join) => {
      const table = sanitizeIdentifier(join.table);
      const left = sanitizeIdentifier(join.onLeft);
      const right = sanitizeIdentifier(join.onRight);
      const joinType = join.type === "left" ? "LEFT JOIN" : join.type === "right" ? "RIGHT JOIN" : "JOIN";
      return `${joinType} ${table} ON ${left} = ${right}`;
    })
    .join(" ");
}

function buildDateBucket(column: string, timeGrain: MetricQuery["timeGrain"], dialect: SqlDialect): string {
  if (!timeGrain) return column;
  if (dialect === "mysql") {
    switch (timeGrain) {
      case "day":
        return `DATE(${column})`;
      case "week":
        return `YEARWEEK(${column}, 1)`;
      case "month":
        return `DATE_FORMAT(${column}, '%Y-%m-01')`;
      case "quarter":
        return `CONCAT(YEAR(${column}), '-Q', QUARTER(${column}))`;
      case "year":
        return `YEAR(${column})`;
      default:
        return column;
    }
  }
  return `date_trunc('${timeGrain}', ${column})`;
}

function resolveOrderBy(orderBy: string | undefined, fallback: string): string {
  if (!orderBy) return fallback;
  if (["bucket", "value", "value2"].includes(orderBy)) return orderBy;
  return sanitizeIdentifier(orderBy);
}

export function buildSqlFromMetric(query: MetricQuery, dialect: SqlDialect): string {
  const table = sanitizeIdentifier(query.table);
  const metricColumn = sanitizeIdentifier(query.metricColumn || "*");
  const aggregation = query.aggregation.toUpperCase();
  const groupBy = query.groupBy ? sanitizeIdentifier(query.groupBy) : "";
  const metricColumn2 = query.metricColumn2 ? sanitizeIdentifier(query.metricColumn2) : "";
  const aggregation2 = query.aggregation2 ? query.aggregation2.toUpperCase() : "";
  const joins = buildJoins(query.joins);
  const where = buildWhere(query.filters, dialect);
  const limit = query.limit ? `LIMIT ${Math.max(1, query.limit)}` : "LIMIT 100";
  const direction = query.orderDirection?.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const aggExpression = aggregation === "COUNT" ? `COUNT(${metricColumn || "*"})` : `${aggregation}(${metricColumn})`;
  const aggExpression2 =
    metricColumn2 && aggregation2
      ? aggregation2 === "COUNT"
        ? `COUNT(${metricColumn2})`
        : `${aggregation2}(${metricColumn2})`
      : "";

  if (groupBy) {
    const bucketExpr = buildDateBucket(groupBy, query.timeGrain, dialect);
    const selectMetrics = aggExpression2
      ? `${aggExpression} AS value, ${aggExpression2} AS value2`
      : `${aggExpression} AS value`;
    const orderBy = resolveOrderBy(query.orderBy, "bucket");
    return `SELECT ${bucketExpr} AS bucket, ${selectMetrics} FROM ${table} ${joins} ${where} GROUP BY ${bucketExpr} ORDER BY ${orderBy} ${direction} ${limit};`;
  }

  const orderBy = resolveOrderBy(query.orderBy, "value");
  const selectMetrics = aggExpression2 ? `${aggExpression} AS value, ${aggExpression2} AS value2` : `${aggExpression} AS value`;
  return `SELECT ${selectMetrics} FROM ${table} ${joins} ${where} ORDER BY ${orderBy} ${direction} ${limit};`;
}

export async function runDashboardWidget(widget: DashboardWidget, pod: Pod, ctx: QueryContext): Promise<QueryResult> {
  if (ctx.dataSource === "firebase") {
    throw new Error("Dashboards require SQL data sources. Switch to Local SQL in Profile.");
  }
  const sql = buildSqlFromMetric(widget.query, detectDialect(ctx));
  return runQuery(sql, ctx);
}

export function collectChatTrends(pod: Pod): DashboardWidget[] {
  const widgets = pod.dashboards.flatMap((dashboard) => dashboard.widgets);
  return widgets.filter((widget) => widget.showInChat).slice(0, 3);
}
