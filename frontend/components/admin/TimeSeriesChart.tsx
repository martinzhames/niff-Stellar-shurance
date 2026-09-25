import { useMemo } from "react";

export interface TimeSeriesPoint {
  /** ISO date or label for the bucket (e.g. "2024-06-01"). */
  date: string;
  /** Numeric value for the bucket. */
  value: number;
}

export interface TimeSeriesChartProps {
  /** Chart title, also used as the accessible caption. */
  title: string;
  /** Ordered data points to render. */
  data: TimeSeriesPoint[];
  /** Optional value formatter for axis labels and the data table. */
  formatValue?: (value: number) => string;
  /** Optional accessible description of the series. */
  description?: string;
  /** Height of the SVG plot area in pixels. */
  height?: number;
}

const DEFAULT_HEIGHT = 160;
const PADDING = { top: 12, right: 12, bottom: 24, left: 48 };

/**
 * Lightweight, dependency-free time series chart.
 *
 * Renders an inline SVG line/area chart with a visually hidden data table so
 * screen reader users get the same information as sighted users.
 */
export default function TimeSeriesChart({
  title,
  data,
  formatValue = (value) => value.toLocaleString(),
  description,
  height = DEFAULT_HEIGHT,
}: TimeSeriesChartProps) {
  const { points, path, areaPath, maxValue, minValue, width } = useMemo(() => {
    const chartWidth = 640;
    const innerWidth = chartWidth - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;

    if (data.length === 0) {
      return {
        points: [] as Array<TimeSeriesPoint & { x: number; y: number }>,
        path: "",
        areaPath: "",
        maxValue: 0,
        minValue: 0,
        width: chartWidth,
      };
    }

    const values = data.map((point) => point.value);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    const max = rawMax === rawMin ? rawMax + 1 : rawMax;
    const min = rawMax === rawMin ? Math.min(0, rawMin) : rawMin;
    const span = max - min || 1;

    const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;

    const mapped = data.map((point, index) => ({
      ...point,
      x: PADDING.left + index * step,
      y: PADDING.top + innerHeight - ((point.value - min) / span) * innerHeight,
    }));

    const line = mapped
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(" ");

    const baseline = PADDING.top + innerHeight;
    const area = `${line} L${mapped[mapped.length - 1].x.toFixed(2)},${baseline} L${mapped[0].x.toFixed(2)},${baseline} Z`;

    return {
      points: mapped,
      path: line,
      areaPath: area,
      maxValue: rawMax,
      minValue: rawMin,
      width: chartWidth,
    };
  }, [data, height]);

  const tableId = `time-series-table-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <figure className="admin-chart" role="group" aria-label={title}>
      <figcaption className="admin-chart__title">{title}</figcaption>
      {description ? <p className="admin-chart__description">{description}</p> : null}

      {data.length === 0 ? (
        <p className="admin-chart__empty">No data available for the selected range.</p>
      ) : (
        <svg
          className="admin-chart__svg"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-labelledby={`${tableId}-caption`}
          preserveAspectRatio="none"
        >
          <title id={`${tableId}-caption`}>{title}</title>
          <line
            x1={PADDING.left}
            y1={PADDING.top + height - PADDING.top - PADDING.bottom}
            x2={width - PADDING.right}
            y2={PADDING.top + height - PADDING.top - PADDING.bottom}
            className="admin-chart__axis"
          />
          <text x={4} y={PADDING.top + 4} className="admin-chart__axis-label">
            {formatValue(maxValue)}
          </text>
          <text x={4} y={height - PADDING.bottom} className="admin-chart__axis-label">
            {formatValue(minValue)}
          </text>
          <path d={areaPath} className="admin-chart__area" />
          <path d={path} className="admin-chart__line" />
          {points.map((point) => (
            <circle
              key={point.date}
              cx={point.x}
              cy={point.y}
              r={2.5}
              className="admin-chart__point"
            >
              <title>{`${point.date}: ${formatValue(point.value)}`}</title>
            </circle>
          ))}
        </svg>
      )}

      <table className="visually-hidden" id={tableId}>
        <caption>{title} data table</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.date}</th>
              <td>{formatValue(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
