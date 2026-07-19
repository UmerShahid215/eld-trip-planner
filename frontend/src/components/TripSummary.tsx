import type { Trip } from "../types";
import { DUTY_COLORS, DUTY_LABELS, STOP_META, formatHours, formatMiles } from "../lib/duty";
import type { DutyStatus, StopType } from "../types";

function Stat({
  label,
  value,
  unit,
  sub,
  icon,
  accent = "#1e3050",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-steel-200 bg-white p-3.5 shadow-card transition-shadow hover:shadow-cardhover">
      <span
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="flex items-center gap-2">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-white"
          style={{ background: accent }}
          aria-hidden
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-steel-400">
          {label}
        </span>
      </div>
      <div className="mt-1.5 whitespace-nowrap text-xl font-extrabold leading-none text-ink tabular">
        {value}
        {unit && <span className="ml-1 text-sm font-bold text-steel-400">{unit}</span>}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-steel-500">{sub}</div>}
    </div>
  );
}

export default function TripSummary({ trip }: { trip: Trip }) {
  const stopCounts = trip.stops.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] || 0) + 1;
    return acc;
  }, {});

  const dutyKeys: DutyStatus[] = ["OFF_DUTY", "SLEEPER_BERTH", "DRIVING", "ON_DUTY_NOT_DRIVING"];
  const legendStops: StopType[] = ["pickup", "fuel", "rest", "restart", "break", "dropoff"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Total distance"
          value={formatMiles(trip.total_miles)}
          unit="mi"
          sub="both legs"
          accent="#1e3050"
          icon={
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2.2" />
            </svg>
          }
        />
        <Stat
          label="Drive time"
          value={formatHours(trip.total_drive_hours)}
          sub={`${formatHours(trip.total_on_duty_hours)} on-duty`}
          accent="#f59e0b"
          icon={
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <Stat
          label="Trip duration"
          value={String(trip.total_days)}
          unit={trip.total_days === 1 ? "day" : "days"}
          sub={formatHours(trip.total_duration_hours)}
          accent="#0ea5a4"
          icon={
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="4" y="5" width="16" height="16" rx="2" />
              <path d="M4 9h16M8 3v4M16 3v4" strokeLinecap="round" />
            </svg>
          }
        />
        <Stat
          label="Log sheets"
          value={String(trip.total_days)}
          sub="one grid per day"
          accent="#6366f1"
          icon={
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Planned stops</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-steel-100 px-2.5 py-0.5 text-[11px] font-semibold text-steel-600">
            <span className="h-1.5 w-1.5 rounded-full bg-duty-onduty" aria-hidden />
            {trip.routing_provider || "n/a"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {legendStops
            .filter((t) => stopCounts[t])
            .map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-steel-200 bg-steel-50 py-1 pl-1 pr-2.5 text-xs font-medium text-ink"
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: STOP_META[t].color }}
                >
                  {STOP_META[t].glyph}
                </span>
                {STOP_META[t].label}
                <span className="tabular font-semibold text-steel-400">×{stopCounts[t]}</span>
              </span>
            ))}
        </div>
      </div>

      <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
        <h3 className="text-sm font-bold text-ink">Duty status legend</h3>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {dutyKeys.map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs font-medium text-steel-600">
              <span
                className="h-3 w-6 shrink-0 rounded-full ring-1 ring-inset ring-black/5"
                style={{ background: DUTY_COLORS[k] }}
              />
              {DUTY_LABELS[k]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
