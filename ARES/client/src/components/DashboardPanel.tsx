import { useEffect, useMemo, useState } from "react";
import type { Dashboard, DashboardFilter, DashboardJoin, DashboardWidget, MetricQuery } from "../lib/types";
import { createDashboard, deleteDashboard, fetchDashboards, runWidget, updateDashboard } from "../lib/api";
import ChartView from "./ChartView";

type DashboardPanelProps = {
  podId?: string;
  activeDataSource?: string;
};

const emptyQuery: MetricQuery = {
  table: "",
  metricColumn: "*",
  metricColumn2: "",
  aggregation: "count",
  aggregation2: "sum",
  groupBy: "",
  timeGrain: "month",
  orderBy: "",
  orderDirection: "desc",
  joins: [],
  filters: [],
  limit: 100
};

const emptyWidget: DashboardWidget = {
  id: "",
  title: "",
  description: "",
  chartType: "line",
  query: emptyQuery,
  showInChat: true
};

const filterOps: DashboardFilter["op"][] = ["=", "!=", ">", ">=", "<", "<=", "contains", "in", "between"];
const joinTypes: Array<DashboardJoin["type"]> = ["inner", "left", "right"];

function normalizeWidget(widget: DashboardWidget): DashboardWidget {
  const query = widget.query;
  return {
    ...widget,
    query: {
      ...query,
      metricColumn: query.metricColumn || "*",
      joins: query.joins.filter((j) => j.table && j.onLeft && j.onRight),
      filters: query.filters.filter((f) => f.column && f.value)
    }
  };
}

export default function DashboardPanel({ podId, activeDataSource }: DashboardPanelProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [draftWidget, setDraftWidget] = useState<DashboardWidget>(emptyWidget);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ columns: string[]; rows: any[] } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dashboardDraft, setDashboardDraft] = useState({ name: "", description: "" });

  useEffect(() => {
    if (!podId) return;
    fetchDashboards(podId)
      .then((data) => {
        setDashboards(data);
        setActiveId(data[0]?.id ?? null);
      })
      .catch((err) => setStatus(err instanceof Error ? err.message : "Failed to load dashboards"));
  }, [podId]);

  const active = useMemo(() => dashboards.find((d) => d.id === activeId) ?? null, [dashboards, activeId]);

  useEffect(() => {
    if (!active) {
      setDashboardDraft({ name: "", description: "" });
      setDraftWidget(emptyWidget);
      setSelectedWidgetId(null);
      return;
    }
    setDashboardDraft({ name: active.name, description: active.description ?? "" });
    setDraftWidget(emptyWidget);
    setSelectedWidgetId(null);
  }, [activeId]);

  async function handleCreate() {
    if (!podId || !newName.trim()) return;
    const list = await createDashboard(podId, { name: newName.trim() });
    setDashboards(list);
    setActiveId(list[list.length - 1]?.id ?? null);
    setNewName("");
  }

  async function handleSaveDashboardMeta() {
    if (!podId || !active) return;
    if (!dashboardDraft.name.trim()) {
      setStatus("Dashboard name is required.");
      return;
    }
    const updated = await updateDashboard(podId, active.id, {
      name: dashboardDraft.name.trim(),
      description: dashboardDraft.description
    });
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function handleSaveWidget() {
    if (!podId || !active) return;
    const widgetId = selectedWidgetId ?? `widget_${Date.now()}`;
    const widget: DashboardWidget = normalizeWidget({
      ...draftWidget,
      id: widgetId
    });
    const nextWidgets = selectedWidgetId
      ? active.widgets.map((w) => (w.id === widgetId ? widget : w))
      : [...active.widgets, widget];
    const updated = await updateDashboard(podId, active.id, { widgets: nextWidgets });
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setSelectedWidgetId(widgetId);
    setDraftWidget(widget);
  }

  async function handleDeleteWidget() {
    if (!podId || !active || !selectedWidgetId) return;
    const nextWidgets = active.widgets.filter((w) => w.id !== selectedWidgetId);
    const updated = await updateDashboard(podId, active.id, { widgets: nextWidgets });
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    setSelectedWidgetId(null);
    setDraftWidget(emptyWidget);
  }

  async function handleDeleteDashboard() {
    if (!podId || !active) return;
    await deleteDashboard(podId, active.id);
    const list = dashboards.filter((d) => d.id !== active.id);
    setDashboards(list);
    setActiveId(list[0]?.id ?? null);
  }

  async function handlePreview() {
    if (!podId) return;
    try {
      const data = await runWidget(podId, normalizeWidget(draftWidget));
      setPreview(data);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Preview failed");
    }
  }

  function handleSelectWidget(widget: DashboardWidget) {
    setSelectedWidgetId(widget.id);
    setDraftWidget(widget);
    setPreview(null);
  }

  function handleNewWidget() {
    setSelectedWidgetId(null);
    setDraftWidget(emptyWidget);
    setPreview(null);
  }

  function updateFilter(index: number, next: DashboardFilter) {
    const filters = [...draftWidget.query.filters];
    filters[index] = next;
    setDraftWidget({ ...draftWidget, query: { ...draftWidget.query, filters } });
  }

  function updateJoin(index: number, next: DashboardJoin) {
    const joins = [...draftWidget.query.joins];
    joins[index] = next;
    setDraftWidget({ ...draftWidget, query: { ...draftWidget.query, joins } });
  }

  return (
    <div className="drawer-panel">
      <div className="panel-header">
        <h2>Dashboards</h2>
        <span className="panel-subtitle">Build custom metrics + visuals</span>
      </div>

      {status && <div className="error-banner">{status}</div>}

      <div className="dashboard-hero">
        <div>
          <div className="card-title">Create a dashboard</div>
          <div className="panel-subtitle">Create a dashboard to start building widgets.</div>
        </div>
        <div className="dashboard-hero-actions">
          <input
            className="dashboard-input designer-input"
            value={newName}
            placeholder="Dashboard name"
            onChange={(event) => setNewName(event.target.value)}
          />
          <button className="primary-button" onClick={handleCreate}>Create</button>
        </div>
      </div>

      <div className="dashboard-layout">
        <div className="dashboard-list">

          {dashboards.map((dashboard) => (
            <button
              key={dashboard.id}
              className={`dashboard-pill ${dashboard.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(dashboard.id)}
            >
              {dashboard.name}
            </button>
          ))}
        </div>

        <div className="dashboard-editor">
          {!active ? (
            <div className="empty-state">Create a dashboard to start building widgets.</div>
          ) : (
            <>
              <div className="dashboard-header">
                <div className="dashboard-meta">
                  <input
                    className="designer-input"
                    value={dashboardDraft.name}
                    placeholder="Dashboard name"
                    onChange={(event) => setDashboardDraft({ ...dashboardDraft, name: event.target.value })}
                  />
                  <textarea
                    className="designer-input"
                    value={dashboardDraft.description}
                    placeholder="Description"
                    onChange={(event) => setDashboardDraft({ ...dashboardDraft, description: event.target.value })}
                  />
                </div>
                <div className="dashboard-actions">
                  <button className="ghost-button" onClick={handleSaveDashboardMeta}>Save</button>
                  <button className="ghost-button" onClick={handleDeleteDashboard}>Delete</button>
                </div>
              </div>

              <div className="widget-library">
                <div className="widget-library-header">
                  <div className="panel-subtitle">Widgets</div>
                  <button className="ghost-button" onClick={handleNewWidget}>New Widget</button>
                </div>
                <div className="widget-list">
                  {active.widgets.length === 0 && <div className="panel-subtitle">No widgets yet.</div>}
                  {active.widgets.map((widget) => (
                    <button
                      key={widget.id}
                      className={`widget-card ${widget.id === selectedWidgetId ? "active" : ""}`}
                      onClick={() => handleSelectWidget(widget)}
                    >
                      <div className="widget-title">{widget.title || "Untitled"}</div>
                      <div className="panel-subtitle">{widget.chartType} chart</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="widget-form">
                <div className="widget-section">
                  <input
                    value={draftWidget.title}
                    placeholder="Widget title"
                    onChange={(event) => setDraftWidget({ ...draftWidget, title: event.target.value })}
                  />
                  <textarea
                    value={draftWidget.description ?? ""}
                    placeholder="Widget description"
                    onChange={(event) => setDraftWidget({ ...draftWidget, description: event.target.value })}
                  />
                </div>

                <div className="widget-row">
                  <select
                    value={draftWidget.chartType}
                    onChange={(event) =>
                      setDraftWidget({ ...draftWidget, chartType: event.target.value as DashboardWidget["chartType"] })
                    }
                  >
                    <option value="line">Line</option>
                    <option value="bar">Bar</option>
                    <option value="pie">Pie</option>
                  </select>

                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={draftWidget.showInChat}
                      onChange={(event) => setDraftWidget({ ...draftWidget, showInChat: event.target.checked })}
                    />
                    Show in chat trends
                  </label>
                </div>

                <div className="widget-section">
                  <div className="panel-subtitle">Metrics</div>
                  <div className="widget-row">
                    <input
                      className="designer-input"
                      value={draftWidget.query.table}
                      placeholder="Table"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, table: event.target.value }
                        })
                      }
                    />
                    <input
                      value={draftWidget.query.metricColumn}
                      placeholder="Metric column"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, metricColumn: event.target.value }
                        })
                      }
                    />
                    <select
                      value={draftWidget.query.aggregation}
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, aggregation: event.target.value as MetricQuery["aggregation"] }
                        })
                      }
                    >
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Avg</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>

                  <div className="widget-row">
                    <input
                      value={draftWidget.query.metricColumn2 ?? ""}
                      placeholder="Second metric column (optional)"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, metricColumn2: event.target.value }
                        })
                      }
                    />
                    <select
                      value={draftWidget.query.aggregation2 ?? "sum"}
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, aggregation2: event.target.value as MetricQuery["aggregation"] }
                        })
                      }
                    >
                      <option value="count">Count</option>
                      <option value="sum">Sum</option>
                      <option value="avg">Avg</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                  </div>
                </div>

                <div className="widget-section">
                  <div className="panel-subtitle">Grouping</div>
                  <div className="widget-row">
                    <input
                      value={draftWidget.query.groupBy ?? ""}
                      placeholder="Group by column (optional)"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, groupBy: event.target.value }
                        })
                      }
                    />
                    <select
                      value={draftWidget.query.timeGrain ?? "month"}
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, timeGrain: event.target.value as MetricQuery["timeGrain"] }
                        })
                      }
                      disabled={!draftWidget.query.groupBy}
                    >
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="quarter">Quarter</option>
                      <option value="year">Year</option>
                    </select>
                    <div className="panel-subtitle">
                      {activeDataSource === "localSql" && "Time grain uses Postgres syntax for local SQL."}
                    </div>
                  </div>
                </div>

                <div className="widget-section">
                  <div className="panel-subtitle">Filters</div>
                  {(draftWidget.query.filters.length ? draftWidget.query.filters : [{ column: "", op: "=", value: "" }]).map(
                    (filter, index) => (
                      <div key={index} className="filter-row">
                        <input
                          value={filter.column}
                          placeholder="Column"
                          onChange={(event) => updateFilter(index, { ...filter, column: event.target.value })}
                        />
                        <select
                          value={filter.op}
                          onChange={(event) => updateFilter(index, { ...filter, op: event.target.value as DashboardFilter["op"] })}
                        >
                          {filterOps.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                        {filter.op === "between" ? (
                          <>
                            <input
                              value={filter.value}
                              placeholder="From"
                              onChange={(event) => updateFilter(index, { ...filter, value: event.target.value })}
                            />
                            <input
                              value={filter.valueTo ?? ""}
                              placeholder="To"
                              onChange={(event) => updateFilter(index, { ...filter, valueTo: event.target.value })}
                            />
                          </>
                        ) : (
                          <input
                            value={filter.value}
                            placeholder={filter.op === "in" ? "Value1, Value2" : "Value"}
                            onChange={(event) => updateFilter(index, { ...filter, value: event.target.value })}
                          />
                        )}
                        <button
                          className="ghost-button"
                          onClick={() =>
                            setDraftWidget({
                              ...draftWidget,
                              query: {
                                ...draftWidget.query,
                                filters: draftWidget.query.filters.filter((_, idx) => idx !== index)
                              }
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                  <button
                    className="ghost-button"
                    onClick={() =>
                      setDraftWidget({
                        ...draftWidget,
                        query: {
                          ...draftWidget.query,
                          filters: [...draftWidget.query.filters, { column: "", op: "=", value: "" }]
                        }
                      })
                    }
                  >
                    Add Filter
                  </button>
                </div>

                <div className="widget-section">
                  <div className="panel-subtitle">Joins</div>
                  {(draftWidget.query.joins.length ? draftWidget.query.joins : [{ table: "", onLeft: "", onRight: "", type: "inner" }]).map(
                    (join, index) => (
                      <div key={index} className="join-row">
                        <select
                          value={join.type ?? "inner"}
                          onChange={(event) => updateJoin(index, { ...join, type: event.target.value as DashboardJoin["type"] })}
                        >
                          {joinTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <input
                          value={join.table}
                          placeholder="Join table"
                          onChange={(event) => updateJoin(index, { ...join, table: event.target.value })}
                        />
                        <input
                          value={join.onLeft}
                          placeholder="Left column"
                          onChange={(event) => updateJoin(index, { ...join, onLeft: event.target.value })}
                        />
                        <input
                          value={join.onRight}
                          placeholder="Right column"
                          onChange={(event) => updateJoin(index, { ...join, onRight: event.target.value })}
                        />
                        <button
                          className="ghost-button"
                          onClick={() =>
                            setDraftWidget({
                              ...draftWidget,
                              query: {
                                ...draftWidget.query,
                                joins: draftWidget.query.joins.filter((_, idx) => idx !== index)
                              }
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    )
                  )}
                  <button
                    className="ghost-button"
                    onClick={() =>
                      setDraftWidget({
                        ...draftWidget,
                        query: {
                          ...draftWidget.query,
                          joins: [...draftWidget.query.joins, { table: "", onLeft: "", onRight: "", type: "inner" }]
                        }
                      })
                    }
                  >
                    Add Join
                  </button>
                </div>

                <div className="widget-section">
                  <div className="panel-subtitle">Sort + Limits</div>
                  <div className="widget-row">
                    <input
                      value={draftWidget.query.orderBy ?? ""}
                      placeholder="Order by (bucket, value, value2, or column)"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, orderBy: event.target.value }
                        })
                      }
                    />
                    <select
                      value={draftWidget.query.orderDirection ?? "desc"}
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, orderDirection: event.target.value as MetricQuery["orderDirection"] }
                        })
                      }
                    >
                      <option value="desc">DESC</option>
                      <option value="asc">ASC</option>
                    </select>
                    <input
                      value={draftWidget.query.limit ?? 100}
                      placeholder="Limit"
                      onChange={(event) =>
                        setDraftWidget({
                          ...draftWidget,
                          query: { ...draftWidget.query, limit: Number(event.target.value) || 100 }
                        })
                      }
                    />
                  </div>
                </div>

                <div className="widget-actions">
                  <button className="ghost-button" onClick={handlePreview}>Preview</button>
                  <button className="primary-button" onClick={handleSaveWidget}>
                    {selectedWidgetId ? "Save Widget" : "Add Widget"}
                  </button>
                  {selectedWidgetId && (
                    <button className="ghost-button" onClick={handleDeleteWidget}>
                      Remove Widget
                    </button>
                  )}
                </div>

                {preview && (
                  <div className="widget-preview">
                    <div className="card-title">Preview</div>
                    <ChartView rows={preview.rows} columns={preview.columns} hint={draftWidget.chartType} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
