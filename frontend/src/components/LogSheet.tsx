import type { DutyDay, DutyStatus } from "../types";
import { DUTY_COLORS, DUTY_ROWS, formatHours } from "../lib/duty";

interface Props {
  day: DutyDay;
  fromLabel: string;
  toLabel: string;
  milesToday: number;
  totalMilesTrip: number;
  driverCycleUsed: number;
  /** Optional authentic-document fields (derived by the parent). */
  carrier?: string;
  mainOffice?: string;
  homeTerminal?: string;
  tractorNo?: string;
  trailerNo?: string;
  shipper?: string;
  commodity?: string;
  proNo?: string;
  /** Cumulative on-duty hours in the 70hr/8day cycle *before* this day begins. */
  cycleUsedBeforeToday?: number;
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

/** "2026-07-19" -> { m: "07", d: "19", y: "2026" } (best-effort). */
function splitDate(date: string | null): { m: string; d: string; y: string } {
  if (date) {
    const parts = date.split("-");
    if (parts.length === 3) return { y: parts[0], m: parts[1], d: parts[2] };
  }
  return { m: "—", d: "—", y: "—" };
}

/** A fill-in-the-blank field: micro label above a ruled value. */
function Blank({
  label,
  value,
  className = "",
  mono = true,
}: {
  label: string;
  value: string;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide text-steel-400">
        {label}
      </div>
      <div
        className={`truncate border-b border-steel-300 pb-0.5 text-[13px] leading-5 text-ink ${
          mono ? "font-mono" : "font-semibold"
        }`}
        title={value}
      >
        {value || " "}
      </div>
    </div>
  );
}

export default function LogSheet({
  day,
  fromLabel,
  toLabel,
  milesToday,
  totalMilesTrip,
  driverCycleUsed,
  carrier = "RouteLog Carriers, Inc.",
  mainOffice = "1200 Interstate Plaza, Columbus, OH 43215",
  homeTerminal,
  tractorNo,
  trailerNo,
  shipper = "Consolidated Freight LLC",
  commodity = "General freight — palletized",
  proNo,
  cycleUsedBeforeToday,
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

  // --- Derived document values -------------------------------------------
  const { m, d, y } = splitDate(day.date);
  const drivingToday = day.totals.DRIVING || 0;
  const onDutyToday = drivingToday + (day.totals.ON_DUTY_NOT_DRIVING || 0);
  const usedBefore = cycleUsedBeforeToday ?? driverCycleUsed;
  const cycleUsedIncl = Math.min(70, usedBefore + onDutyToday);
  const availableTomorrow = Math.max(0, 70 - cycleUsedIncl);
  const cyclePct = Math.min(100, (cycleUsedIncl / 70) * 100);
  const milesDrivingToday = Math.round(milesToday).toLocaleString();
  const _proNo = proNo ?? `PRO ${100340 + day.day_number * 7}`;
  const _tractor = tractorNo ?? `TRK ${4021 + day.day_number}`;
  const _trailer = trailerNo ?? `TRL ${8837 + day.day_number}`;
  const _homeTerminal = homeTerminal ?? fromLabel;

  return (
    <section className="animate-fade-up overflow-hidden rounded-xl border border-steel-300 bg-paper shadow-paper print:shadow-none">
      {/* ── Document masthead ───────────────────────────────────────────── */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-ink px-5 pb-3 pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-steel-400">
            U.S. Department of Transportation
          </div>
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-black uppercase tracking-tight text-ink">
              Driver's Daily Log
            </h3>
            <span className="text-[11px] font-medium text-steel-500">
              (one calendar day — 24 hours)
            </span>
          </div>
          <div className="mt-0.5 text-[10px] italic text-steel-400">
            Original — file at home terminal · Duplicate — driver retains for 8 days
          </div>
        </div>

        <div className="flex items-end gap-4">
          {/* Day badge */}
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-ink text-amber-400 shadow-card">
            <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-steel-300">
              Day
            </span>
            <span className="text-lg font-black leading-none">{day.day_number}</span>
          </div>
          {/* Date boxes */}
          <div className="flex items-end gap-1.5 font-mono">
            {[
              { lbl: "Month", v: m },
              { lbl: "Day", v: d },
              { lbl: "Year", v: y },
            ].map((b) => (
              <div key={b.lbl} className="text-center">
                <div className="text-[8px] font-semibold uppercase tracking-wide text-steel-400">
                  {b.lbl}
                </div>
                <div
                  className={`grid place-items-center rounded border border-steel-300 bg-white text-sm font-bold text-ink ${
                    b.lbl === "Year" ? "h-8 w-14" : "h-8 w-10"
                  }`}
                >
                  {b.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Carrier / mileage / vehicle block ───────────────────────────── */}
      <div className="grid gap-x-6 gap-y-3 border-b border-steel-200 px-5 py-3.5 sm:grid-cols-12">
        <Blank
          label="From"
          value={fromLabel}
          mono={false}
          className="sm:col-span-3"
        />
        <Blank
          label="To"
          value={toLabel}
          mono={false}
          className="sm:col-span-3"
        />
        <Blank
          label="Total miles driving today"
          value={milesDrivingToday}
          className="sm:col-span-3"
        />
        <Blank
          label="Total mileage today"
          value={milesDrivingToday}
          className="sm:col-span-3"
        />
        <Blank
          label="Name of carrier or carriers"
          value={carrier}
          mono={false}
          className="sm:col-span-6"
        />
        <Blank
          label="Main office address"
          value={mainOffice}
          className="sm:col-span-6"
        />
        <Blank
          label="Home terminal address"
          value={_homeTerminal}
          mono={false}
          className="sm:col-span-6"
        />
        <Blank
          label="Truck / tractor & trailer no."
          value={`${_tractor}  ·  ${_trailer}`}
          className="sm:col-span-6"
        />
      </div>

      {/* ── The 24-hour graph grid (SVG — unchanged rendering) ──────────── */}
      <div className="overflow-x-auto bg-white/40 px-3 py-4">
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

      {/* ── Shipping documents ──────────────────────────────────────────── */}
      <div className="grid gap-x-6 gap-y-3 border-t border-steel-200 px-5 py-3.5 sm:grid-cols-12">
        <Blank label="Pro or shipping no." value={_proNo} className="sm:col-span-4" />
        <Blank
          label="Shipper & commodity"
          value={`${shipper} — ${commodity}`}
          mono={false}
          className="sm:col-span-8"
        />
      </div>

      {/* ── Recap: 70-hour / 8-day ──────────────────────────────────────── */}
      <footer className="border-t-2 border-ink bg-steel-50/60 px-5 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-steel-500">
            Recap · 70 hr / 8 day · complete at end of day
          </div>
          <div className="text-[10px] font-medium text-steel-400">
            Cycle used at trip start: {formatHours(driverCycleUsed)} · Trip total{" "}
            {Math.round(totalMilesTrip).toLocaleString()} mi
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <RecapCell
            label="On-duty hours today"
            hint="lines 3 + 4"
            value={formatHours(onDutyToday)}
          />
          <RecapCell
            label="Driving hours today"
            hint="line 3"
            value={formatHours(drivingToday)}
          />
          <RecapCell
            label="Used incl. today"
            hint="of 70 hr"
            value={formatHours(cycleUsedIncl)}
          />
          <RecapCell
            label="Available tomorrow"
            hint="70 − used"
            value={formatHours(availableTomorrow)}
            accent
          />
        </div>

        {/* Cycle utilisation bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] font-medium text-steel-500">
            <span>70-hour cycle utilisation</span>
            <span className="tabular">{Math.round(cyclePct)}%</span>
          </div>
          <div
            className="mt-1 h-2 w-full overflow-hidden rounded-full bg-steel-200"
            role="progressbar"
            aria-valuenow={Math.round(cyclePct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="70-hour cycle utilisation"
          >
            <div
              className={`h-full rounded-full transition-all ${
                cyclePct >= 90 ? "bg-red-500" : cyclePct >= 75 ? "bg-amber-500" : "bg-duty-onduty"
              }`}
              style={{ width: `${cyclePct}%` }}
            />
          </div>
        </div>

        {/* Certification line */}
        <div className="mt-3.5 flex items-end gap-3 border-t border-dashed border-steel-300 pt-3">
          <div className="text-[10px] italic text-steel-400">
            I certify these entries are true and correct:
          </div>
          <div className="flex-1 border-b border-steel-400 pb-0.5 text-right font-mono text-sm text-ink/80">
            {carrier.split(",")[0]} · Driver
          </div>
        </div>
      </footer>
    </section>
  );
}

function RecapCell({
  label,
  hint,
  value,
  accent = false,
}: {
  label: string;
  hint: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        accent
          ? "border-amber-300 bg-amber-50"
          : "border-steel-200 bg-white"
      }`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-steel-500">
          {label}
        </span>
        <span className="text-[9px] font-medium text-steel-400">{hint}</span>
      </div>
      <div className="mt-0.5 text-base font-extrabold tabular text-ink">{value}</div>
    </div>
  );
}
