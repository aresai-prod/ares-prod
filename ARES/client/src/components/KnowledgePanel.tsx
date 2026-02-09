import { useEffect, useState } from "react";
import type { DataSources, DataSourceKey, KnowledgeBase, KnowledgeBankEntry, KnowledgeQuality, Pod } from "../lib/types";

type KnowledgePanelProps = {
  pods: Pod[];
  activePodId?: string;
  podName?: string;
  knowledge: KnowledgeBase;
  dataSources: DataSources;
  knowledgeBank: KnowledgeBankEntry[];
  quality?: KnowledgeQuality | null;
  isBusiness: boolean;
  isAdmin: boolean;
  onEvaluateQuality: () => void;
  onSaveKnowledge: (next: KnowledgeBase) => void;
  onSaveSources: (next: DataSources) => void;
  onAddKnowledgeBank: (entry: {
    title: string;
    date: string;
    highlights: string;
    lowlights: string;
    docText?: string;
  }, podId?: string) => void;
  onTestLocal: (connectionString: string) => Promise<boolean>;
  onTestPostgres: (connectionString: string) => Promise<boolean>;
  onTestMysql: (connectionString: string) => Promise<boolean>;
  onTestFirebase: (projectId: string, serviceAccountJson: string) => Promise<boolean>;
};

type TabKey = "tables" | "columns" | "parameters" | "metrics" | "sources" | "bank";

function parseCsv(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));
}

export default function KnowledgePanel({
  pods,
  activePodId,
  podName,
  knowledge,
  dataSources,
  knowledgeBank,
  quality,
  isBusiness,
  isAdmin,
  onEvaluateQuality,
  onSaveKnowledge,
  onSaveSources,
  onAddKnowledgeBank,
  onTestLocal,
  onTestPostgres,
  onTestMysql,
  onTestFirebase
}: KnowledgePanelProps) {
  const [tab, setTab] = useState<TabKey>("tables");
  const [draft, setDraft] = useState<KnowledgeBase>(knowledge);
  const [sourceDraft, setSourceDraft] = useState<DataSources>(dataSources);
  const [sourceStatus, setSourceStatus] = useState<string | null>(null);
  const [activeConnector, setActiveConnector] = useState<DataSourceKey>("localSql");
  const [connectorForms, setConnectorForms] = useState({
    localSql: {
      driver: "postgres",
      host: "localhost",
      port: "5432",
      database: "",
      user: "",
      password: "",
      ssl: "disable"
    },
    postgres: {
      host: "",
      port: "5432",
      database: "",
      user: "",
      password: "",
      ssl: "require"
    },
    mysql: {
      host: "",
      port: "3306",
      database: "",
      user: "",
      password: "",
      ssl: "disable"
    },
    firebase: {
      projectId: "",
      serviceAccountJson: ""
    }
  });
  const [bankForm, setBankForm] = useState({
    topic: "",
    date: "",
    highlights: "",
    lowlights: "",
    docText: "",
    podId: activePodId ?? ""
  });
  const qualityScore = quality?.score ?? null;

  useEffect(() => {
    setDraft(knowledge);
  }, [knowledge]);

  useEffect(() => {
    setSourceDraft(dataSources);
    try {
      const localUrl = dataSources.localSql.connectionString ? new URL(dataSources.localSql.connectionString) : null;
      const postgresUrl = dataSources.postgres.connectionString ? new URL(dataSources.postgres.connectionString) : null;
      const mysqlUrl = dataSources.mysql.connectionString ? new URL(dataSources.mysql.connectionString) : null;
      setConnectorForms((prev) => ({
        ...prev,
        localSql: {
          ...prev.localSql,
          driver: localUrl?.protocol.includes("mysql") ? "mysql" : "postgres",
          host: localUrl?.hostname || "localhost",
          port: localUrl?.port || (localUrl?.protocol.includes("mysql") ? "3306" : "5432"),
          database: localUrl?.pathname?.replace("/", "") || "",
          user: localUrl?.username ? decodeURIComponent(localUrl.username) : "",
          password: localUrl?.password ? decodeURIComponent(localUrl.password) : "",
          ssl: localUrl?.searchParams.get("sslmode") ?? "disable"
        },
        postgres: {
          ...prev.postgres,
          host: postgresUrl?.hostname || prev.postgres.host,
          port: postgresUrl?.port || "5432",
          database: postgresUrl?.pathname?.replace("/", "") || "",
          user: postgresUrl?.username ? decodeURIComponent(postgresUrl.username) : "",
          password: postgresUrl?.password ? decodeURIComponent(postgresUrl.password) : "",
          ssl: postgresUrl?.searchParams.get("sslmode") ?? "require"
        },
        mysql: {
          ...prev.mysql,
          host: mysqlUrl?.hostname || prev.mysql.host,
          port: mysqlUrl?.port || "3306",
          database: mysqlUrl?.pathname?.replace("/", "") || "",
          user: mysqlUrl?.username ? decodeURIComponent(mysqlUrl.username) : "",
          password: mysqlUrl?.password ? decodeURIComponent(mysqlUrl.password) : ""
        },
        firebase: {
          projectId: dataSources.firebase.projectId,
          serviceAccountJson: dataSources.firebase.serviceAccountJson
        }
      }));
    } catch {
      // ignore parse errors
    }
  }, [dataSources]);

  useEffect(() => {
    if (activePodId) {
      setBankForm((prev) => ({ ...prev, podId: activePodId }));
    }
  }, [activePodId]);

  function buildSqlConnection(key: "localSql" | "postgres" | "mysql"): string {
    const form =
      key === "localSql" ? connectorForms.localSql : key === "postgres" ? connectorForms.postgres : connectorForms.mysql;
    const protocol = key === "mysql" || (key === "localSql" && connectorForms.localSql.driver === "mysql") ? "mysql" : "postgres";
    const host = form.host || "localhost";
    const port =
      form.port ||
      (protocol === "mysql" ? "3306" : "5432");
    const database = form.database || "";
    const user = form.user ? encodeURIComponent(form.user) : "";
    const password = form.password ? encodeURIComponent(form.password) : "";
    const auth = user ? `${user}:${password}@` : "";
    const base = `${protocol}://${auth}${host}:${port}/${database}`;
    if (protocol === "postgres") {
      const sslMode = form.ssl && form.ssl !== "disable" ? form.ssl : "";
      return sslMode ? `${base}?sslmode=${sslMode}` : base;
    }
    return base;
  }

  const connectors: Array<{ key: DataSourceKey; title: string; subtitle: string; icon: string }> = [
    { key: "localSql", title: "Local SQL", subtitle: "Localhost", icon: "SQL" },
    { key: "postgres", title: "PostgreSQL", subtitle: "Hosted", icon: "PG" },
    { key: "mysql", title: "MySQL", subtitle: "Hosted", icon: "MY" },
    { key: "firebase", title: "Firebase", subtitle: "Firestore", icon: "FB" }
  ];

  async function handleTestConnector(key: DataSourceKey) {
    try {
      if (key === "firebase") {
        setSourceStatus("Testing Firebase...");
        const ok = await onTestFirebase(
          connectorForms.firebase.projectId,
          connectorForms.firebase.serviceAccountJson
        );
        setSourceStatus(ok ? "Firebase connection OK." : "Firebase connection failed.");
        return;
      }
      const connectionString = buildSqlConnection(key);
      if (key === "localSql") {
        setSourceStatus("Testing Local SQL...");
        const ok = await onTestLocal(connectionString);
        setSourceStatus(ok ? "Local SQL connection OK." : "Local SQL connection failed.");
      } else if (key === "postgres") {
        setSourceStatus("Testing PostgreSQL...");
        const ok = await onTestPostgres(connectionString);
        setSourceStatus(ok ? "PostgreSQL connection OK." : "PostgreSQL connection failed.");
      } else if (key === "mysql") {
        setSourceStatus("Testing MySQL...");
        const ok = await onTestMysql(connectionString);
        setSourceStatus(ok ? "MySQL connection OK." : "MySQL connection failed.");
      }
    } catch {
      setSourceStatus("Connection test failed.");
    }
  }

  function handleSaveConnector(key: DataSourceKey) {
    if (key === "firebase") {
      const next = {
        ...sourceDraft,
        firebase: {
          ...sourceDraft.firebase,
          projectId: connectorForms.firebase.projectId,
          serviceAccountJson: connectorForms.firebase.serviceAccountJson
        }
      };
      setSourceDraft(next);
      onSaveSources(next);
      setSourceStatus("Firebase saved.");
      return;
    }
    const connectionString = buildSqlConnection(key);
    const next = {
      ...sourceDraft,
      [key]: {
        ...sourceDraft[key],
        connectionString
      }
    } as DataSources;
    setSourceDraft(next);
    onSaveSources(next);
    setSourceStatus(`${key === "localSql" ? "Local SQL" : key === "postgres" ? "PostgreSQL" : "MySQL"} saved.`);
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>Knowledge</h2>
        <span className="panel-subtitle">Pod: {podName ?? "-"}</span>
      </div>

      <div className="quality-card">
        <div>
          <div className="quality-score">{qualityScore ?? "Not scored"}</div>
          <div className="panel-subtitle">Knowledge quality score</div>
          {quality?.notes && <div className="quality-notes">{quality.notes}</div>}
          {qualityScore !== null && (
            <div className="quality-meter">
              <span style={{ width: `${Math.max(4, qualityScore)}%` }} />
            </div>
          )}
        </div>
        <div className="quality-actions">
          {isAdmin && (
            <button className="ghost-button" onClick={onEvaluateQuality}>
              Evaluate quality
            </button>
          )}
        </div>
      </div>

      <div className="tab-row">
        <button className={tab === "tables" ? "active" : ""} onClick={() => setTab("tables")}>
          Tables
        </button>
        <button className={tab === "columns" ? "active" : ""} onClick={() => setTab("columns")}>
          Columns
        </button>
        <button className={tab === "parameters" ? "active" : ""} onClick={() => setTab("parameters")}>
          Parameters
        </button>
        <button className={tab === "metrics" ? "active" : ""} onClick={() => setTab("metrics")}>
          Metrics
        </button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>
          Sources
        </button>
        <button className={tab === "bank" ? "active" : ""} onClick={() => setTab("bank")}>
          Knowledge Bank
        </button>
      </div>

      <div className="tab-content">
        {tab === "tables" && (
          <div className="tab-section">
            <div className="tab-actions">
              <label className="upload-button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const rows = parseCsv(text);
                    const items = rows.map(([tableName, description]) => ({
                      tableName: tableName || "",
                      description: description || ""
                    }));
                    setDraft({ ...draft, tableDictionary: items });
                  }}
                />
              </label>
              <button
                className="ghost-button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    tableDictionary: [
                      ...draft.tableDictionary,
                      { tableName: "", description: "" }
                    ]
                  })
                }
              >
                Add Row
              </button>
            </div>

            {draft.tableDictionary.map((item, index) => (
              <div key={index} className="form-row">
                <input
                  value={item.tableName}
                  placeholder="orders"
                  onChange={(event) => {
                    const next = [...draft.tableDictionary];
                    next[index] = { ...next[index], tableName: event.target.value };
                    setDraft({ ...draft, tableDictionary: next });
                  }}
                />
                <input
                  value={item.description}
                  placeholder="Customer orders"
                  onChange={(event) => {
                    const next = [...draft.tableDictionary];
                    next[index] = { ...next[index], description: event.target.value };
                    setDraft({ ...draft, tableDictionary: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {tab === "columns" && (
          <div className="tab-section">
            <div className="tab-actions">
              <label className="upload-button">
                Upload CSV
                <input
                  type="file"
                  accept=".csv"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    const rows = parseCsv(text);
                    const items = rows.map(([tableName, columnName, dataType, description, filterable]) => ({
                      tableName: tableName || "",
                      columnName: columnName || "",
                      dataType: dataType || "",
                      description: description || "",
                      filterable: filterable === "true"
                    }));
                    setDraft({ ...draft, columnDictionary: items });
                  }}
                />
              </label>
              <button
                className="ghost-button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    columnDictionary: [
                      ...draft.columnDictionary,
                      {
                        tableName: "",
                        columnName: "",
                        dataType: "",
                        description: "",
                        filterable: false
                      }
                    ]
                  })
                }
              >
                Add Row
              </button>
            </div>

            {draft.columnDictionary.map((item, index) => (
              <div key={index} className="form-row columns">
                <input
                  value={item.tableName}
                  placeholder="orders"
                  onChange={(event) => {
                    const next = [...draft.columnDictionary];
                    next[index] = { ...next[index], tableName: event.target.value };
                    setDraft({ ...draft, columnDictionary: next });
                  }}
                />
                <input
                  value={item.columnName}
                  placeholder="order_id"
                  onChange={(event) => {
                    const next = [...draft.columnDictionary];
                    next[index] = { ...next[index], columnName: event.target.value };
                    setDraft({ ...draft, columnDictionary: next });
                  }}
                />
                <input
                  value={item.dataType}
                  placeholder="uuid"
                  onChange={(event) => {
                    const next = [...draft.columnDictionary];
                    next[index] = { ...next[index], dataType: event.target.value };
                    setDraft({ ...draft, columnDictionary: next });
                  }}
                />
                <input
                  value={item.description}
                  placeholder="Unique order id"
                  onChange={(event) => {
                    const next = [...draft.columnDictionary];
                    next[index] = { ...next[index], description: event.target.value };
                    setDraft({ ...draft, columnDictionary: next });
                  }}
                />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={item.filterable}
                    onChange={(event) => {
                      const next = [...draft.columnDictionary];
                      next[index] = { ...next[index], filterable: event.target.checked };
                      setDraft({ ...draft, columnDictionary: next });
                    }}
                  />
                  Filter
                </label>
              </div>
            ))}
          </div>
        )}

        {tab === "parameters" && (
          <div className="tab-section">
            <label>Date Handling Rules</label>
            <textarea
              value={draft.parameters.dateHandlingRules}
              placeholder="Use UTC dates and ISO-8601 strings."
              onChange={(event) =>
                setDraft({
                  ...draft,
                  parameters: { ...draft.parameters, dateHandlingRules: event.target.value }
                })
              }
            />

            <label>Best Query Practices</label>
            <textarea
              value={draft.parameters.bestQueryPractices}
              placeholder="Always limit results unless user asks for full output."
              onChange={(event) =>
                setDraft({
                  ...draft,
                  parameters: { ...draft.parameters, bestQueryPractices: event.target.value }
                })
              }
            />

            <label>Business Context</label>
            <textarea
              value={draft.parameters.businessContext}
              placeholder="Describe the business context for this dataset."
              onChange={(event) =>
                setDraft({
                  ...draft,
                  parameters: { ...draft.parameters, businessContext: event.target.value }
                })
              }
            />

            <label>Sample Queries (one per line)</label>
            <textarea
              value={draft.parameters.sampleQueries.join("\n")}
              placeholder="Total revenue by month"
              onChange={(event) =>
                setDraft({
                  ...draft,
                  parameters: {
                    ...draft.parameters,
                    sampleQueries: event.target.value.split(/\r?\n/).filter(Boolean)
                  }
                })
              }
            />
          </div>
        )}

        {tab === "metrics" && (
          <div className="tab-section">
            <button
              className="ghost-button"
              onClick={() =>
                setDraft({
                  ...draft,
                  metrics: [
                    ...draft.metrics,
                    { name: "", definition: "", sampleQuery: "", defaultFilters: "" }
                  ]
                })
              }
            >
              Add Metric
            </button>
            {draft.metrics.map((metric, index) => (
              <div key={index} className="metric-card">
                <input
                  value={metric.name}
                  placeholder="Monthly Revenue"
                  onChange={(event) => {
                    const next = [...draft.metrics];
                    next[index] = { ...next[index], name: event.target.value };
                    setDraft({ ...draft, metrics: next });
                  }}
                />
                <textarea
                  value={metric.definition}
                  placeholder="Sum of order totals grouped by month"
                  onChange={(event) => {
                    const next = [...draft.metrics];
                    next[index] = { ...next[index], definition: event.target.value };
                    setDraft({ ...draft, metrics: next });
                  }}
                />
                <textarea
                  value={metric.sampleQuery}
                  placeholder="SELECT date_trunc('month', created_at) AS month, SUM(total) AS revenue FROM orders GROUP BY 1"
                  onChange={(event) => {
                    const next = [...draft.metrics];
                    next[index] = { ...next[index], sampleQuery: event.target.value };
                    setDraft({ ...draft, metrics: next });
                  }}
                />
                <input
                  value={metric.defaultFilters}
                  placeholder="status = 'completed'"
                  onChange={(event) => {
                    const next = [...draft.metrics];
                    next[index] = { ...next[index], defaultFilters: event.target.value };
                    setDraft({ ...draft, metrics: next });
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {tab === "sources" && (
          <div className="tab-section">
            <div className="source-status">Set the active data source in Profile.</div>
            <div className="connector-grid">
              {connectors.map((connector) => (
                <button
                  key={connector.key}
                  className={`connector-card ${activeConnector === connector.key ? "active" : ""}`}
                  onClick={() => setActiveConnector(connector.key)}
                >
                  <div className="connector-icon">{connector.icon}</div>
                  <div>
                    <div className="connector-title">{connector.title}</div>
                    <div className="connector-subtitle">{connector.subtitle}</div>
                  </div>
                </button>
              ))}
            </div>

            {activeConnector === "localSql" && (
              <div className="connector-form">
                <div className="panel-subtitle">Local SQL connection</div>
                <div className="connector-row">
                  <label>Driver</label>
                  <select
                    value={connectorForms.localSql.driver}
                    onChange={(event) =>
                      setConnectorForms((prev) => ({
                        ...prev,
                        localSql: { ...prev.localSql, driver: event.target.value }
                      }))
                    }
                  >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                  </select>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Host</label>
                    <input
                      value={connectorForms.localSql.host}
                      placeholder="localhost"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, host: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>Port</label>
                    <input
                      value={connectorForms.localSql.port}
                      placeholder={connectorForms.localSql.driver === "mysql" ? "3306" : "5432"}
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, port: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Database</label>
                    <input
                      value={connectorForms.localSql.database}
                      placeholder="ares_db"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, database: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>User</label>
                    <input
                      value={connectorForms.localSql.user}
                      placeholder="db_user"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, user: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Password</label>
                    <input
                      type="password"
                      value={connectorForms.localSql.password}
                      placeholder="••••••••"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, password: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>SSL Mode</label>
                    <select
                      value={connectorForms.localSql.ssl}
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          localSql: { ...prev.localSql, ssl: event.target.value }
                        }))
                      }
                    >
                      <option value="disable">disable</option>
                      <option value="require">require</option>
                      <option value="prefer">prefer</option>
                    </select>
                  </div>
                </div>
                <div className="connector-actions">
                  <button className="ghost-button" onClick={() => handleTestConnector("localSql")}>
                    Test Connection
                  </button>
                  <button className="primary-button" onClick={() => handleSaveConnector("localSql")}>
                    Save Connector
                  </button>
                </div>
              </div>
            )}

            {activeConnector === "postgres" && (
              <div className="connector-form">
                <div className="panel-subtitle">Hosted PostgreSQL</div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Host</label>
                    <input
                      value={connectorForms.postgres.host}
                      placeholder="db.example.com"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, host: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>Port</label>
                    <input
                      value={connectorForms.postgres.port}
                      placeholder="5432"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, port: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Database</label>
                    <input
                      value={connectorForms.postgres.database}
                      placeholder="analytics"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, database: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>User</label>
                    <input
                      value={connectorForms.postgres.user}
                      placeholder="db_user"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, user: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Password</label>
                    <input
                      type="password"
                      value={connectorForms.postgres.password}
                      placeholder="••••••••"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, password: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>SSL Mode</label>
                    <select
                      value={connectorForms.postgres.ssl}
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          postgres: { ...prev.postgres, ssl: event.target.value }
                        }))
                      }
                    >
                      <option value="require">require</option>
                      <option value="prefer">prefer</option>
                      <option value="disable">disable</option>
                    </select>
                  </div>
                </div>
                <div className="connector-actions">
                  <button className="ghost-button" onClick={() => handleTestConnector("postgres")}>
                    Test Connection
                  </button>
                  <button className="primary-button" onClick={() => handleSaveConnector("postgres")}>
                    Save Connector
                  </button>
                </div>
              </div>
            )}

            {activeConnector === "mysql" && (
              <div className="connector-form">
                <div className="panel-subtitle">Hosted MySQL</div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Host</label>
                    <input
                      value={connectorForms.mysql.host}
                      placeholder="db.example.com"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, host: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>Port</label>
                    <input
                      value={connectorForms.mysql.port}
                      placeholder="3306"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, port: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Database</label>
                    <input
                      value={connectorForms.mysql.database}
                      placeholder="analytics"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, database: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>User</label>
                    <input
                      value={connectorForms.mysql.user}
                      placeholder="db_user"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, user: event.target.value }
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="connector-grid-2">
                  <div className="connector-field">
                    <label>Password</label>
                    <input
                      type="password"
                      value={connectorForms.mysql.password}
                      placeholder="••••••••"
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, password: event.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="connector-field">
                    <label>SSL</label>
                    <select
                      value={connectorForms.mysql.ssl}
                      onChange={(event) =>
                        setConnectorForms((prev) => ({
                          ...prev,
                          mysql: { ...prev.mysql, ssl: event.target.value }
                        }))
                      }
                    >
                      <option value="disable">disable</option>
                      <option value="require">require</option>
                      <option value="prefer">prefer</option>
                    </select>
                  </div>
                </div>
                <div className="connector-actions">
                  <button className="ghost-button" onClick={() => handleTestConnector("mysql")}>
                    Test Connection
                  </button>
                  <button className="primary-button" onClick={() => handleSaveConnector("mysql")}>
                    Save Connector
                  </button>
                </div>
              </div>
            )}

            {activeConnector === "firebase" && (
              <div className="connector-form">
                <div className="panel-subtitle">Firebase service account</div>
                <div className="connector-field">
                  <label>Project ID</label>
                  <input
                    value={connectorForms.firebase.projectId}
                    placeholder="your-project-id"
                    onChange={(event) =>
                      setConnectorForms((prev) => ({
                        ...prev,
                        firebase: { ...prev.firebase, projectId: event.target.value }
                      }))
                    }
                  />
                </div>
                <div className="connector-field">
                  <label>Service Account JSON</label>
                  <textarea
                    value={connectorForms.firebase.serviceAccountJson}
                    placeholder="Paste the service account JSON"
                    onChange={(event) =>
                      setConnectorForms((prev) => ({
                        ...prev,
                        firebase: { ...prev.firebase, serviceAccountJson: event.target.value }
                      }))
                    }
                  />
                </div>
                <div className="connector-actions">
                  <button className="ghost-button" onClick={() => handleTestConnector("firebase")}>
                    Test Connection
                  </button>
                  <button className="primary-button" onClick={() => handleSaveConnector("firebase")}>
                    Save Connector
                  </button>
                </div>
              </div>
            )}

            {sourceStatus && <div className="source-status">{sourceStatus}</div>}
          </div>
        )}

        {tab === "bank" && (
          <div className="tab-section">
            <div className="panel-subtitle">Add a knowledge bank entry</div>
            {isBusiness && (
              <div className="connector-field">
                <label>POD</label>
                <select
                  value={bankForm.podId}
                  onChange={(event) => setBankForm({ ...bankForm, podId: event.target.value })}
                >
                  {pods.map((pod) => (
                    <option key={pod.id} value={pod.id}>
                      {pod.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <input
              value={bankForm.topic}
              placeholder="Topic (e.g. Q1 Performance)"
              onChange={(event) => setBankForm({ ...bankForm, topic: event.target.value })}
            />
            <input
              value={bankForm.date}
              type="date"
              placeholder="YYYY-MM-DD"
              onChange={(event) => setBankForm({ ...bankForm, date: event.target.value })}
            />
            <textarea
              value={bankForm.highlights}
              placeholder="Highlights (wins, positives, momentum)"
              onChange={(event) => setBankForm({ ...bankForm, highlights: event.target.value })}
            />
            <textarea
              value={bankForm.lowlights}
              placeholder="Lowlights (risks, blockers, declines)"
              onChange={(event) => setBankForm({ ...bankForm, lowlights: event.target.value })}
            />
            <label className="upload-button">
              Upload Doc (txt/md)
              <input
                type="file"
                accept=".txt,.md"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setBankForm({ ...bankForm, docText: text });
                }}
              />
            </label>
            <button
              className="primary-button"
              onClick={() => {
                onAddKnowledgeBank(
                  {
                    title: bankForm.topic,
                    date: bankForm.date,
                    highlights: bankForm.highlights,
                    lowlights: bankForm.lowlights,
                    docText: bankForm.docText
                  },
                  bankForm.podId || activePodId
                );
                setBankForm({ topic: "", date: "", highlights: "", lowlights: "", docText: "", podId: bankForm.podId });
              }}
            >
              Save Entry
            </button>

            <div className="knowledge-bank-list">
              {knowledgeBank.map((entry) => (
                <div key={entry.id} className="knowledge-bank-card">
                  <div className="knowledge-bank-title">{entry.title}</div>
                  <div className="panel-subtitle">{entry.date}</div>
                  <div className="knowledge-bank-text">Highlights: {entry.highlights}</div>
                  <div className="knowledge-bank-text">Lowlights: {entry.lowlights}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="knowledge-footer">
        {tab === "sources" ? null : tab === "bank" ? null : (
          <button className="primary-button" onClick={() => onSaveKnowledge(draft)}>
            Save Knowledge
          </button>
        )}
      </div>
    </div>
  );
}
