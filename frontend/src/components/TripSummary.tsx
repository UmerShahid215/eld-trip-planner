import type { Trip } from "../types";
import { DUTY_COLORS, DUTY_LABELS, STOP_META, formatHours, formatMiles } from "../lib/duty";
import type { DutyStatus, StopType } from "../types";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-steel-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-ink tabular">{value}</div>
      {sub && <div className="text-xs text-steel-500">{sub}</div>}
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total distance" value={`${formatMiles(trip.total_miles)} mi`} sub="both legs" />
        <Stat label="Drive time" value={formatHours(trip.total_drive_hours)} sub={`${formatHours(trip.total_on_duty_hours)} on-duty`} />
        <Stat label="Trip duration" value={`${trip.total_days} ${trip.total_days === 1 ? "day" : "days"}`} sub={formatHours(trip.total_duration_hours)} />
        <Stat label="Log sheets" value={String(trip.total_days)} sub="one grid per day" />
      </div>

      <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink">Planned stops</h3>
          <span className="rounded-full bg-steel-100 px-2.5 py-0.5 text-[11px] font-semibold text-steel-600">
            routing: {trip.routing_provider || "n/a"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {legendStops
            .filter((t) => stopCounts[t])
            .map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full border border-steel-200 bg-steel-50 px-2.5 py-1 text-xs font-medium text-ink"
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-white"
                  style={{ background: STOP_META[t].color }}
                >
                  {STOP_META[t].glyph}
                </span>
                {STOP_META[t].label}
                <span className="tabular text-steel-500">×{stopCounts[t]}</span>
              </span>
            ))}
        </div>
      </div>

      <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
        <h3 className="text-sm font-bold text-ink">Duty status legend</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {dutyKeys.map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs text-steel-600">
              <span className="h-3 w-6 rounded-full" style={{ background: DUTY_COLORS[k] }} />
              {DUTY_LABELS[k]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
