"use client";

import { useId, type ReactNode } from "react";

/**
 * The dot-matrix chart, TrueBook's chart identity (v3 noir): the served line
 * is drawn twice (a 20% echo under the crisp stroke), the area under it is a
 * green gradient MASKED by 0.5px dots on a 2x2px grid (never a solid wash),
 * and the consensus reference line is data blue, 1px, dashed.
 * sourceRef: ui-design/returns (accepted exports) and the reference DOM.
 */

export type ChartPoint = { x: number; y: number };

/**
 * Step-curve geometry: cubic segments whose control points sit at the
 * horizontal midpoint, so the line steps between points with soft shoulders.
 */
export function buildStepPath(points: ReadonlyArray<ChartPoint>): string {
  if (points.length === 0) {
    return "";
  }
  let path = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let pointIndex = 1; pointIndex < points.length; pointIndex += 1) {
    const previousPoint = points[pointIndex - 1];
    const currentPoint = points[pointIndex];
    const midX = ((previousPoint.x + currentPoint.x) / 2).toFixed(1);
    path += `C${midX},${previousPoint.y.toFixed(1)},${midX},${currentPoint.y.toFixed(1)},${currentPoint.x.toFixed(1)},${currentPoint.y.toFixed(1)}`;
  }
  return path;
}

type DotMatrixChartProps = {
  servedPoints: ReadonlyArray<ChartPoint>;
  /** The TxLINE consensus reference line, dashed data blue. */
  consensusPoints?: ReadonlyArray<ChartPoint>;
  viewWidth: number;
  viewHeight: number;
  /** Bottom edge the gradient fill closes to (usually below the last label). */
  fillBaselineY: number;
  /** Draw-on entrance: line sweeps 600ms, then the dot fill fades in 250ms. */
  drawOnLoad?: boolean;
  /** Extra svg content (time labels, markers), rendered above the paths. */
  children?: ReactNode;
  className?: string;
  ariaLabel: string;
};

/* Colors read the theme tokens (svg attributes take var() via style only). */
const CHART_FILL_OPACITY = 0.32;
const CHART_FILL_COLOR = "var(--color-chart-fill)";
const SERVED_LINE_COLOR = "var(--color-accent)";
const CONSENSUS_LINE_COLOR = "var(--color-blue)";
const FIELD_COLOR = "var(--color-field)";

export function DotMatrixChart({
  servedPoints,
  consensusPoints,
  viewWidth,
  viewHeight,
  fillBaselineY,
  drawOnLoad = false,
  children,
  className,
  ariaLabel,
}: DotMatrixChartProps) {
  // useId carries colons, which break url(#id) references inside svg.
  const chartId = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const servedPath = buildStepPath(servedPoints);
  const lastServedPoint = servedPoints[servedPoints.length - 1];
  const firstServedPoint = servedPoints[0];
  const fillPath =
    servedPoints.length > 0
      ? `${servedPath}L${lastServedPoint.x.toFixed(1)},${fillBaselineY}L${firstServedPoint.x.toFixed(1)},${fillBaselineY}Z`
      : "";
  const consensusPath = consensusPoints
    ? buildStepPath(consensusPoints)
    : null;

  const drawOnStyle = drawOnLoad
    ? { strokeDasharray: 1, strokeDashoffset: 1, animationDelay: "650ms" }
    : undefined;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      overflow="visible"
      role="img"
      aria-label={ariaLabel}
      className={className}
    >
      <defs>
        <linearGradient
          id={`${chartId}-gradient`}
          x1="0%"
          x2="0%"
          y1="0"
          y2={fillBaselineY}
          gradientUnits="userSpaceOnUse"
        >
          <stop
            style={{ stopColor: CHART_FILL_COLOR }}
            stopOpacity={CHART_FILL_OPACITY}
          />
          <stop
            offset="100%"
            style={{ stopColor: FIELD_COLOR }}
            stopOpacity="0"
          />
        </linearGradient>
        <pattern
          id={`${chartId}-dots`}
          x="0"
          y="0"
          width="2"
          height="2"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.5" fill="white" />
        </pattern>
        <mask id={`${chartId}-mask`}>
          <rect width="100%" height="100%" fill={`url(#${chartId}-dots)`} />
        </mask>
      </defs>
      {fillPath ? (
        <path
          d={fillPath}
          strokeWidth="0"
          fill={`url(#${chartId}-gradient)`}
          mask={`url(#${chartId}-mask)`}
          className={drawOnLoad ? "animate-fill-fade opacity-0" : undefined}
          style={drawOnLoad ? { animationDelay: "1250ms" } : undefined}
        />
      ) : null}
      {consensusPath ? (
        <path
          d={consensusPath}
          strokeWidth="1"
          strokeDasharray="2 3"
          fill="transparent"
          className={drawOnLoad ? "animate-fill-fade opacity-0" : undefined}
          style={{
            stroke: CONSENSUS_LINE_COLOR,
            ...(drawOnLoad ? { animationDelay: "1450ms" } : { opacity: 0.85 }),
          }}
        />
      ) : null}
      {/* The served line, drawn twice: a soft echo under the crisp stroke. */}
      <path
        d={servedPath}
        pathLength={1}
        strokeWidth="1.5"
        fill="transparent"
        opacity="0.2"
        className={drawOnLoad ? "animate-draw-line" : undefined}
        style={{ stroke: SERVED_LINE_COLOR, ...(drawOnStyle ?? {}) }}
      />
      <path
        d={servedPath}
        pathLength={1}
        strokeWidth="1.5"
        fill="transparent"
        className={drawOnLoad ? "animate-draw-line" : undefined}
        style={{ stroke: SERVED_LINE_COLOR, ...(drawOnStyle ?? {}) }}
      />
      {children}
    </svg>
  );
}

/** Legend row shared by every chart: two 6px dots with muted labels. */
export function ChartLegend() {
  return (
    <div className="flex justify-end gap-4 text-2xs text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-accent"
        />
        served price
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-blue" />
        TxLINE consensus
      </span>
    </div>
  );
}
