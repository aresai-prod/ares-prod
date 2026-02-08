import type { ChatResponse } from "../lib/types";
import ChartView from "./ChartView";

const emptyState = {
  sql: "-- Your SQL will appear here",
  analysis: "Ask a question to see AI analysis.",
  columns: [],
  rows: [] as Array<Record<string, string | number | boolean | null>>
};

type TrendWidget = {
  widgetId: string;
  title: string;
  chartType: "line" | "bar" | "pie";
  data: { columns: string[]; rows: Array<Record<string, string | number | boolean | null>> };
};

type ResultsPanelProps = {
  response: ChatResponse | null;
  loading: boolean;
  error: string | null;
  onFeedback: (rating: "up" | "down", comment?: string) => void;
  activePod?: string;
  trends: TrendWidget[];
};

const keywordSet = new Set([
  "SELECT",
  "FROM",
  "WHERE",
  "GROUP",
  "BY",
  "ORDER",
  "LIMIT",
  "JOIN",
  "ON",
  "AS",
  "SUM",
  "COUNT",
  "AVG",
  "MIN",
  "MAX",
  "AND",
  "OR",
  "IN",
  "BETWEEN",
  "DATE_TRUNC"
]);

function highlightSql(sql: string) {
  const tokens = sql.match(/'(?:''|[^'])*'|[A-Za-z_][A-Za-z0-9_.]*|\s+|[^A-Za-z0-9_\s]+/g) ?? [];
  let expectTable = false;

  return tokens.map((token, index) => {
    if (/^\s+$/.test(token)) {
      return <span key={index} className="sql-plain">{token}</span>;
    }

    if (token.startsWith("'")) {
      return <span key={index} className="sql-string">{token}</span>;
    }

    const upper = token.toUpperCase();
    if (expectTable && /^[A-Za-z_]/.test(token)) {
      expectTable = false;
      return <span key={index} className="sql-table">{token}</span>;
    }

    if (keywordSet.has(upper)) {
      if (upper === "FROM" || upper === "JOIN") {
        expectTable = true;
      }
      return <span key={index} className="sql-keyword">{upper}</span>;
    }

    return <span key={index} className="sql-plain">{token}</span>;
  });
}

export default function ResultsPanel({ response, loading, error, onFeedback, activePod, trends }: ResultsPanelProps) {
  const data = response ?? emptyState;

  function downloadCsv() {
    if (data.columns.length === 0) return;
    const lines = [
      data.columns.join(","),
      ...data.rows.map((row) =>
        data.columns.map((col) => JSON.stringify(row[col] ?? "")).join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ares-results.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`panel results-panel ${loading ? "is-loading" : ""}`}>
      <div className="panel-header">
        <h2>Results</h2>
        <span className="panel-subtitle">Pod: {activePod ?? "-"}</span>
      </div>

      <div className="sql-preview">
        <div className="sql-title">SQL Preview</div>
        <pre className="sql-code">
          <code>{highlightSql(data.sql)}</code>
        </pre>
      </div>

      <div className="results-grid">
        <div className="table-card">
          <div className="card-title table-title-row">
            <span>Table Results</span>
            <button className="ghost-button" onClick={downloadCsv} disabled={data.columns.length === 0}>
              Download CSV
            </button>
          </div>
          <div className="table-wrapper">
            {data.columns.length === 0 ? (
              <div className="empty-state">No results yet.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {data.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, index) => (
                    <tr key={index}>
                      {data.columns.map((col) => (
                        <td key={col}>{String(row[col] ?? "-")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="card-title">AI Generated Chart</div>
          <ChartView rows={data.rows} columns={data.columns} hint={response?.chartHint} />
        </div>
      </div>

      {trends.length > 0 && (
        <div className="trend-card">
          <div className="card-title">Dashboard Trends</div>
          <div className="trend-grid">
            {trends.map((trend) => (
              <div key={trend.widgetId} className="trend-item">
                <div className="trend-title">{trend.title}</div>
                <ChartView
                  rows={trend.data.rows}
                  columns={trend.data.columns}
                  hint={trend.chartType}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analysis-card">
        <div className="card-title">AI Analysis</div>
        {loading ? <div className="loading-line" /> : <p>{data.analysis}</p>}
        {error && <div className="error-banner">{error}</div>}
      </div>

      <div className="feedback-bar">
        <span>Was this response helpful?</span>
        <div className="feedback-actions">
          <button className="ghost-button" onClick={() => onFeedback("up")}>Helpful</button>
          <button className="ghost-button" onClick={() => onFeedback("down")}>Not Helpful</button>
          <button
            className="ghost-button"
            onClick={() => {
              const comment = window.prompt("Optional feedback for this response:");
              if (comment) onFeedback("down", comment);
            }}
          >
            Add Note
          </button>
        </div>
      </div>
    </section>
  );
}
