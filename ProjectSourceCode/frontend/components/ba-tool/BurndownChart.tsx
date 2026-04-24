'use client';

import { useMemo } from 'react';
import type { BaBurndown } from '@/lib/ba-api';

interface BurndownChartProps {
  data: BaBurndown;
  height?: number;
}

/**
 * B3 — Minimal inline-SVG burndown chart. Two lines:
 *   - solid: actual remaining work
 *   - dashed: ideal (only when sprint has an endDate)
 *
 * We render by date index (equal spacing per day) rather than true time scale
 * because sprints are typically short (1-4 weeks) and a true time axis adds
 * complexity for no gain at this scale.
 */
export function BurndownChart({ data, height = 200 }: BurndownChartProps) {
  const { days, ideal, totalScope } = data;

  const chartData = useMemo(() => {
    // Merge actual + ideal on a common date index so both lines share the
    // same X grid. The wider of the two series defines the axis.
    const allDates = Array.from(new Set([
      ...days.map((d) => d.date),
      ...(ideal?.map((d) => d.date) ?? []),
    ])).sort();
    const actualByDate = new Map(days.map((d) => [d.date, d.remaining]));
    const idealByDate = new Map((ideal ?? []).map((d) => [d.date, d.remaining]));
    return allDates.map((date, i) => ({
      date,
      index: i,
      actual: actualByDate.get(date),
      ideal: idealByDate.get(date),
    }));
  }, [days, ideal]);

  if (chartData.length === 0 || totalScope === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground italic">
        {data.note ?? 'No data yet for burndown.'}
      </div>
    );
  }

  // Viewport in SVG user units (padded for axis labels).
  const width = 720;
  const padLeft = 32;
  const padRight = 24;
  const padTop = 12;
  const padBottom = 24;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const xMax = Math.max(1, chartData.length - 1);

  const toX = (i: number) => padLeft + (i / xMax) * plotW;
  const toY = (v: number) => padTop + plotH - (v / totalScope) * plotH;

  // Build path strings skipping undefined values so the line doesn't bridge
  // over gaps.
  const lineFor = (key: 'actual' | 'ideal') => {
    const segments: string[] = [];
    let inSeg = false;
    for (const d of chartData) {
      const v = d[key];
      if (v == null) { inSeg = false; continue; }
      const cmd = inSeg ? 'L' : 'M';
      segments.push(`${cmd} ${toX(d.index).toFixed(1)} ${toY(v).toFixed(1)}`);
      inSeg = true;
    }
    return segments.join(' ');
  };

  const actualPath = lineFor('actual');
  const idealPath = lineFor('ideal');

  // Y-axis ticks: 0, 25%, 50%, 75%, 100% of totalScope
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    value: Math.round(totalScope * p),
    y: toY(Math.round(totalScope * p)),
  }));

  // X-axis labels: first, last, and ~4 in between (skip when sparse)
  const xLabelIndices = chartData.length <= 6
    ? chartData.map((_, i) => i)
    : [0, Math.floor(chartData.length / 3), Math.floor((2 * chartData.length) / 3), chartData.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full text-[10px]" role="img" aria-label="Sprint burndown">
      {/* Grid + y-axis labels */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line
            x1={padLeft} x2={width - padRight}
            y1={t.y} y2={t.y}
            stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
          />
          <text x={padLeft - 6} y={t.y + 3} textAnchor="end" fill="currentColor" fillOpacity={0.5}>
            {t.value}
          </text>
        </g>
      ))}

      {/* Ideal line (dashed, muted) */}
      {idealPath && (
        <path
          d={idealPath}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.35}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}

      {/* Actual remaining line */}
      <path
        d={actualPath}
        fill="none"
        stroke="rgb(37, 99, 235)"     /* tailwind blue-600 */
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Point markers on actual line for readability */}
      {chartData.map((d) => d.actual != null && (
        <circle
          key={d.date}
          cx={toX(d.index)}
          cy={toY(d.actual)}
          r={2.5}
          fill="rgb(37, 99, 235)"
        >
          <title>{`${d.date}: ${d.actual} remaining (${totalScope - d.actual} tested)`}</title>
        </circle>
      ))}

      {/* X-axis labels */}
      {xLabelIndices.map((i) => {
        const d = chartData[i];
        if (!d) return null;
        return (
          <text
            key={i}
            x={toX(i)}
            y={height - 6}
            textAnchor={i === 0 ? 'start' : i === chartData.length - 1 ? 'end' : 'middle'}
            fill="currentColor"
            fillOpacity={0.5}
          >
            {d.date.slice(5)}{/* MM-DD */}
          </text>
        );
      })}

      {/* Legend (top-right) */}
      <g transform={`translate(${width - padRight - 130}, ${padTop + 2})`}>
        <rect x={0} y={0} width={128} height={28} fill="currentColor" fillOpacity={0.03} rx={3} />
        <line x1={6} y1={10} x2={22} y2={10} stroke="rgb(37, 99, 235)" strokeWidth={2} />
        <text x={26} y={13} fill="currentColor" fillOpacity={0.8}>Actual</text>
        {idealPath && (
          <>
            <line x1={6} y1={22} x2={22} y2={22} stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.5} strokeDasharray="3 3" />
            <text x={26} y={25} fill="currentColor" fillOpacity={0.55}>Ideal</text>
          </>
        )}
      </g>
    </svg>
  );
}
