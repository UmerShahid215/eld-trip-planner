import type { DutyDay, DutyStatus } from "../types";
import { DUTY_COLORS, DUTY_ROWS, formatHours } from "../lib/duty";

interface Props {
  day: DutyDay;
  fromLabel: string;
  toLabel: string;
  milesToday: number;
  totalMilesTrip: number;
  driverCycleUsed: number;
}

// SVG grid geometry (viewBox units).
const GRID_LEFT = 150;
const HOUR_W = 28;
const HOURS = 24;
const GRID_RIGHT = GRID_LEFT + HOURS * HOUR_W; // 822
const GRID_TOP = 30;
const ROW_H = 30;
const GRID_BOTTOM = GRID_TOP + DUTY_ROWS.length * ROW_H; // 150
const TOTAL_X = (GRID_RIGHT + 872) / 2;
const VB_W = 884;
const REMARKS_TOP = GRID_BOTTOM;
const VB_H = 250;

const ROW_INDEX: Record<DutyStatus, number> = {
  OFF_DUTY: 0,
  SLEEPER_BERTH: 1,
  DRIVING: 2,
  ON_DUTY_NOT_DRIVING: 3,
};

function rowCenterY(status: DutyStatus): number {
  return GRID_TOP + ROW_INDEX[status] * ROW_H + ROW_H / 2;
}

function hourX(h: number): number {
  return GRID_LEFT + h * HOUR_W;
}

function hourLabel(h: number): string {
  if (h === 0 || h === 24) return "Mid";
  if (h === 12) return "Noon";
  return String(h > 12 ? h - 12 : h);
}

export default function LogSheet({
  day,
  fromLabel,
  toLabel,
  milesToday,
  totalMilesTrip,
  driverCycleUsed,
}: Props) {
  const segments = [...day.segments].sort((a, b) => a.start_hour - b.start_hour);

  // Build the stepped duty trace: a colored horizontal bar per segment plus
  // thin vertical connectors at each status change.
  const connectors: { x: number; y1: number; y2: number }[] = [];
  for (let i = 1; i < segments.length; i++) {
    const x = hourX(segments[i].start_hour);
    connectors.push({
      x,
      y1: rowCenterY(segments[i - 1].status),
      y2: rowCenterY(segments[i].status),
    });
  }

  // Remarks: a labelled tick at each change that has a location label.
  const remarks = segments
    .filter((s) => s.location_label)
    .map((s) => ({ x: hourX(s.start_hour), label: s.location_label }));

  const grandTotal = DUTY_ROWS.reduce(
    (sum, r) => sum + (day.totals[r.status] || 0),
    0,
  );

  return (
    <section className="rounded-xl border border-steel-200 bg-paper shadow-card">
      {/* Paper header */}
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-steel-200 px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-600">
            Driver's Daily Log
          </div>
          <div className="text-xl font-bold text-ink">
            Day {day.day_number}
            <span className="ml-2 text-sm font-medium text-steel-500">
              {day.date ?? ""}
            </span>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-steel-600 sm:grid-cols-4">
          <div>
            <dt className="uppercase tracking-wide text-[10px] text-steel-400">From</dt>
            <dd className="font-semibold text-ink truncate max-w-[10rem]">{fromLabel}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-[10px] text-steel-400">To</dt>
            <dd className="font-semibold text-ink truncate max-w-[10rem]">{toLabel}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-[10px] text-steel-400">Miles today</dt>
            <dd className="font-semibold text-ink tabular">{Math.round(milesToday).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-[10px] text-steel-400">Total miles</dt>
            <dd className="font-semibold text-ink tabular">{Math.round(totalMilesTrip).toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      {/* The 24-hour graph grid */}
      <div className="overflow-x-auto px-3 py-4">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="min-w-[720px] w-full"
          role="img"
          aria-label={`Daily log grid for day ${day.day_number}`}
        >
          {/* Hour number header */}
          {Array.from({ length: HOURS + 1 }, (_, h) => (
            <text
              key={`hl-${h}`}
              x={hourX(h)}
              y={GRID_TOP - 10}
              textAnchor="middle"
              className="fill-steel-500"
              fontSize="9"
              fontWeight="600"
            >
              {hourLabel(h)}
            </text>
          ))}

          {/* Row backgrounds + labels + totals */}
          {DUTY_ROWS.map((row, i) => {
            const y = GRID_TOP + i * ROW_H;
            return (
              <g key={row.status}>
                <rect
                  x={GRID_LEFT}
                  y={y}
                  width={GRID_RIGHT - GRID_LEFT}
                  height={ROW_H}
                  fill={i % 2 === 0 ? "#ffffff" : "#f6f4ec"}
                />
                <text
                  x={GRID_LEFT - 8}
                  y={y + ROW_H / 2 + 3}
                  textAnchor="end"
                  className="fill-ink"
                  fontSize="10"
                  fontWeight="600"
                >
                  {row.label}
                </text>
                <text
                  x={TOTAL_X}
                  y={y + ROW_H / 2 + 4}
                  textAnchor="middle"
                  className="fill-ink tabular"
                  fontSize="11"
                  fontWeight="700"
                >
                  {formatHours(day.totals[row.status] || 0)}
                </text>
              </g>
            );
          })}

          {/* Quarter-hour tick marks inside each row */}
          {DUTY_ROWS.map((row, i) => {
            const yTop = GRID_TOP + i * ROW_H;
            return (
              <g key={`ticks-${row.status}`} stroke="#c9cfda" strokeWidth="0.6">
                {Array.from({ length: HOURS }, (_, h) =>
                  [0.25, 0.5, 0.75].map((q) => {
                    const x = hourX(h + q);
                    const len = q === 0.5 ? 9 : 5;
                    return (
                      <line
                        key={`t-${i}-${h}-${q}`}
                        x1={x}
                        y1={yTop}
                        x2={x}
                        y2={yTop + len}
                      />
                    );
                  }),
                )}
              </g>
            );
          })}

          {/* Hour vertical gridlines */}
          {Array.from({ length: HOURS + 1 }, (_, h) => (
            <line
              key={`v-${h}`}
              x1={hourX(h)}
              y1={GRID_TOP}
              x2={hourX(h)}
              y2={GRID_BOTTOM}
              stroke={h % 3 === 0 ? "#8b94a6" : "#c9cfda"}
              strokeWidth={h % 3 === 0 ? 0.9 : 0.5}
            />
          ))}

          {/* Horizontal row separators + outer frame */}
          {Array.from({ length: DUTY_ROWS.length + 1 }, (_, i) => (
            <line
              key={`h-${i}`}
              x1={GRID_LEFT}
              y1={GRID_TOP + i * ROW_H}
              x2={GRID_RIGHT}
              y2={GRID_TOP + i * ROW_H}
              stroke="#8b94a6"
              strokeWidth="0.9"
            />
          ))}
          <line x1={GRID_LEFT} y1={GRID_TOP} x2={GRID_LEFT} y2={GRID_BOTTOM} stroke="#33415a" strokeWidth="1.2" />
          <line x1={GRID_RIGHT} y1={GRID_TOP} x2={GRID_RIGHT} y2={GRID_BOTTOM} stroke="#33415a" strokeWidth="1.2" />

          {/* Vertical connectors at status changes */}
          {connectors.map((c, i) => (
            <line
              key={`c-${i}`}
              x1={c.x}
              y1={c.y1}
              x2={c.x}
              y2={c.y2}
              stroke="#0c1526"
              strokeWidth="1.8"
            />
          ))}

          {/* Colored duty bars */}
          {segments.map((s, i) => (
            <line
              key={`s-${i}`}
              x1={hourX(s.start_hour)}
              y1={rowCenterY(s.status)}
              x2={hourX(s.end_hour)}
              y2={rowCenterY(s.status)}
              stroke={DUTY_COLORS[s.status]}
              strokeWidth="3.6"
              strokeLinecap="round"
            />
          ))}

          {/* Total-column header + grand total */}
          <text x={TOTAL_X} y={GRID_TOP - 10} textAnchor="middle" className="fill-steel-500" fontSize="9" fontWeight="700">
            Total
          </text>
          <line x1={GRID_RIGHT + 6} y1={GRID_BOTTOM + 2} x2={872} y2={GRID_BOTTOM + 2} stroke="#8b94a6" strokeWidth="0.7" />
          <text x={TOTAL_X} y={GRID_BOTTOM + 14} textAnchor="middle" className="fill-ink tabular" fontSize="11" fontWeight="800">
            {formatHours(grandTotal)}
          </text>

          {/* Remarks */}
          <text x={4} y={REMARKS_TOP + 16} className="fill-steel-500" fontSize="9" fontWeight="700">
            REMARKS
          </text>
          {remarks.map((r, i) => (
            <g key={`r-${i}`}>
              <line x1={r.x} y1={GRID_BOTTOM} x2={r.x} y2={GRID_BOTTOM + 8} stroke="#33415a" strokeWidth="0.8" />
              <text
                x={r.x}
                y={GRID_BOTTOM + 12}
                transform={`rotate(55 ${r.x} ${GRID_BOTTOM + 12})`}
                className="fill-ink"
                fontSize="8.5"
                fontWeight="500"
              >
                {r.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Recap strip */}
      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-steel-200 px-5 py-3 text-xs text-steel-600">
        <span>
          On-duty today:{" "}
          <strong className="text-ink tabular">
            {formatHours(
              (day.totals.DRIVING || 0) + (day.totals.ON_DUTY_NOT_DRIVING || 0),
            )}
          </strong>
        </span>
        <span>
          Driving:{" "}
          <strong className="text-ink tabular">{formatHours(day.totals.DRIVING || 0)}</strong>
        </span>
        <span className="text-steel-400">
          Cycle used at trip start: {formatHours(driverCycleUsed)} · 70-hr / 8-day
        </span>
      </footer>
    </section>
  );
}
