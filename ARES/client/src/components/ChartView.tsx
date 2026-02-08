import { useMemo } from "react";

type ChartViewProps = {
  rows: Array<Record<string, string | number | boolean | null>>;
  columns: string[];
  hint?: "line" | "bar" | "pie";
};

const pieColors = ["#4F8CFF", "#3BD6C6", "#FF7A7A", "#FFC857", "#9D7BFF"];
const seriesColors = ["#3A86FF", "#7B2FF7", "#00C4FF", "#FF7A7A", "#00C9A7"];

export default function ChartView({ rows, columns, hint = "line" }: ChartViewProps) {
  const chartData = useMemo(() => {
    if (columns.length < 2) return null;
    const xKey = columns[0];
    const seriesKeys = columns.slice(1);

    const allValues = seriesKeys
      .flatMap((key) => rows.map((row) => Number(row[key])))
      .filter((value) => Number.isFinite(value));

    const min = Math.min(...allValues, 0);
    const max = Math.max(...allValues, 1);

    const series = seriesKeys.map((key, index) => {
      const points = rows.map((row, rowIndex) => {
        const x = (rowIndex / Math.max(rows.length - 1, 1)) * 100;
        const yRaw = Number(row[key]);
        const y = 100 - ((yRaw - min) / (max - min || 1)) * 100;
        return { x, y, label: String(row[xKey] ?? ""), value: yRaw };
      });
      const path = points
        .map((point, idx) => `${idx === 0 ? "M" : "L"}${point.x},${point.y}`)
        .join(" ");
      return { key, color: seriesColors[index % seriesColors.length], points, path };
    });

    return { xKey, series, min, max };
  }, [rows, columns]);

  if (rows.length === 0 || columns.length < 2 || !chartData) {
    return <div className="empty-state">Chart will appear here.</div>;
  }

  if (hint === "pie") {
    const series = chartData.series[0];
    const total = series.points.reduce((sum, point) => sum + (Number.isFinite(point.value) ? point.value : 0), 0);
    let currentAngle = 0;
    const radius = 42;
    const center = 50;

    const slices = series.points.map((point, index) => {
      const value = Number.isFinite(point.value) ? point.value : 0;
      const sliceAngle = total > 0 ? (value / total) * Math.PI * 2 : 0;
      const startAngle = currentAngle;
      const endAngle = currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const path = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return { path, color: pieColors[index % pieColors.length] };
    });

    return (
      <svg viewBox="0 0 100 100" className="pie-chart">
        {slices.map((slice, index) => (
          <path key={index} d={slice.path} fill={slice.color} />
        ))}
      </svg>
    );
  }

  if (hint === "bar") {
    return (
      <div className="bar-chart">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="bar-group">
            {chartData.series.map((series, seriesIndex) => {
              const raw = Number(row[series.key]);
              const normalized = Number.isFinite(raw) ? raw : 0;
              const height = ((normalized - chartData.min) / (chartData.max - chartData.min || 1)) * 100;
              return (
                <div
                  key={series.key}
                  className="bar"
                  style={{ height: `${Math.max(4, height)}%`, background: series.color }}
                  title={`${series.key}: ${normalized}`}
                />
              );
            })}
            <span className="bar-label">{String(row[chartData.xKey] ?? "")}</span>
          </div>
        ))}
        {chartData.series.length > 1 && (
          <div className="chart-legend">
            {chartData.series.map((series) => (
              <div key={series.key} className="legend-item">
                <span className="legend-swatch" style={{ background: series.color }} />
                <span>{series.key}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="line-chart-wrapper">
      <svg viewBox="0 0 100 100" className="line-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ares-line" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3A86FF" />
            <stop offset="100%" stopColor="#72C9F9" />
          </linearGradient>
        </defs>
        {chartData.series.map((series, index) => (
          <g key={series.key}>
            <path
              d={series.path}
              fill="none"
              stroke={index === 0 ? "url(#ares-line)" : series.color}
              strokeWidth="2"
            />
            {series.points.map((point, idx) => (
              <circle key={`${series.key}-${idx}`} cx={point.x} cy={point.y} r="2.2" className="chart-point" />
            ))}
          </g>
        ))}
      </svg>
      {chartData.series.length > 1 && (
        <div className="chart-legend">
          {chartData.series.map((series) => (
            <div key={series.key} className="legend-item">
              <span className="legend-swatch" style={{ background: series.color }} />
              <span>{series.key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
