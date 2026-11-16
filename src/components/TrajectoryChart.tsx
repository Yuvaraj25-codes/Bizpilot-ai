import { useState } from 'react';
import type { CurrencyCode, TrajectoryPoint } from '../../shared/types.ts';
import { formatCompactMoney, formatMoney } from '../lib/formatters.ts';

interface TrajectoryChartProps {
  points: TrajectoryPoint[];
  currency: CurrencyCode;
  publicMode: boolean;
}

export function TrajectoryChart({
  points,
  currency,
  publicMode,
}: TrajectoryChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!points || points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        No trajectory data for this period.
      </div>
    );
  }

  const width = 720;
  const height = 240;
  const padLeft = 56;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 34;

  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    100,
    ...points.map((p) => Math.max(p.revenue, p.profit, 0))
  );
  const niceMax = Math.ceil(maxVal / 100) * 100;

  const getX = (idx: number) =>
    points.length === 1
      ? padLeft + innerW / 2
      : padLeft + (idx / (points.length - 1)) * innerW;

  const getY = (val: number) => {
    const clamped = Math.max(0, val);
    return padTop + innerH - (clamped / niceMax) * innerH;
  };

  const revCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.revenue) }));
  const profCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.profit) }));

  const revLinePath = revCoords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const revAreaPath = `${revLinePath} L ${revCoords[revCoords.length - 1].x.toFixed(1)} ${(
    padTop + innerH
  ).toFixed(1)} L ${revCoords[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const profLinePath = profCoords
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const activeIdx = hoverIdx !== null ? hoverIdx : points.length - 1;
  const activePoint = points[activeIdx];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-5 text-xs">
          <div className="flex items-center gap-2 text-slate-200">
            <span className="inline-block w-3 h-0.5 bg-[#3B82F6]" />
            <span>Revenue</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <span className="inline-block w-3 h-0.5 bg-[#06B6D4]" />
            <span>{publicMode ? 'Net Profit (Masked)' : 'Net Profit'}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-slate-300">
          <span className="text-slate-400">{activePoint.label}</span>
          <span>
            Rev:{' '}
            <strong className="text-white">
              {formatMoney(activePoint.revenue, currency, false)}
            </strong>
          </span>
          <span>
            Profit:{' '}
            <strong className="text-[#06B6D4]">
              {formatMoney(activePoint.profit, currency, publicMode)}
            </strong>
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Revenue and profit trajectory chart"
          onMouseLeave={() => setHoverIdx(null)}
        >
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridTicks.map((ratio) => {
            const y = padTop + innerH - ratio * innerH;
            const val = ratio * niceMax;
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {formatCompactMoney(val, currency, false)}
                </text>
              </g>
            );
          })}

          <path d={revAreaPath} fill="url(#revGrad)" />
          <path
            d={revLinePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {!publicMode && (
            <path
              d={profLinePath}
              fill="none"
              stroke="#06B6D4"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {points.map((pt, idx) => {
            const x = getX(idx);
            const ry = getY(pt.revenue);
            const py = getY(pt.profit);
            const isHovered = hoverIdx === idx;
            const slotWidth =
              points.length > 1 ? innerW / (points.length - 1) : innerW;

            return (
              <g key={pt.label}>
                {isHovered && (
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + innerH}
                    stroke="rgba(6, 182, 212, 0.35)"
                    strokeWidth="1"
                  />
                )}
                <circle
                  cx={x}
                  cy={ry}
                  r={isHovered ? 5 : 3}
                  fill="#3B82F6"
                  stroke="#101828"
                  strokeWidth="1.5"
                />
                {!publicMode && (
                  <circle
                    cx={x}
                    cy={py}
                    r={isHovered ? 4.5 : 2.5}
                    fill="#06B6D4"
                    stroke="#101828"
                    strokeWidth="1.5"
                  />
                )}
                <text
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className={`text-[10px] font-mono ${
                    isHovered ? 'fill-cyan-300 font-semibold' : 'fill-slate-400'
                  }`}
                >
                  {pt.label}
                </text>
                <rect
                  x={x - slotWidth / 2}
                  y={padTop}
                  width={slotWidth}
                  height={innerH + 20}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
