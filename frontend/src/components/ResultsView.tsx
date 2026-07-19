import type { Trip } from "../types";
import LogSheet from "./LogSheet";
import RouteMap from "./RouteMap";
import TripSummary from "./TripSummary";

export default function ResultsView({ trip }: { trip: Trip }) {
  const totalDrive = trip.total_drive_hours || 1;

  // Running cumulative on-duty hours in the 70hr/8day cycle, so each log sheet
  // can print an accurate end-of-day recap ("used incl. today" / "available").
  let cycleRunning = trip.current_cycle_used_hours;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-steel-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" strokeLinejoin="round" />
                <circle cx="12" cy="10" r="2.2" />
              </svg>
              Route map
            </h2>
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-steel-500">
              <span className="truncate">{trip.current_location}</span>
              <span className="text-amber-500">→</span>
              <span className="truncate">{trip.pickup_location}</span>
              <span className="text-amber-500">→</span>
              <span className="truncate">{trip.dropoff_location}</span>
            </span>
          </div>
          <div className="h-[420px]">
            <RouteMap trip={trip} />
          </div>
        </div>
        <div className="lg:col-span-2">
          <TripSummary trip={trip} />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-amber-400 shadow-card">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <path d="M9 8h6M9 12h6M9 16h4" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-ink">Daily log sheets</h2>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {trip.total_days} {trip.total_days === 1 ? "sheet" : "sheets"}
          </span>
          <span className="ml-auto hidden text-xs text-steel-400 sm:block">
            One certified grid per calendar day
          </span>
        </div>
        <div className="space-y-5">
          {trip.days.map((day) => {
            const cycleUsedBeforeToday = cycleRunning;
            cycleRunning +=
              (day.totals.DRIVING || 0) + (day.totals.ON_DUTY_NOT_DRIVING || 0);
            return (
              <LogSheet
                key={day.day_number}
                day={day}
                fromLabel={day.day_number === 1 ? trip.current_location : "En route"}
                toLabel={
                  day.day_number === trip.total_days ? trip.dropoff_location : "En route"
                }
                milesToday={(trip.total_miles * (day.totals.DRIVING || 0)) / totalDrive}
                totalMilesTrip={trip.total_miles}
                driverCycleUsed={trip.current_cycle_used_hours}
                homeTerminal={trip.current_location}
                tractorNo={`TRK ${4000 + trip.id}`}
                trailerNo={`TRL ${8800 + trip.id}`}
                proNo={`PRO ${100000 + trip.id * 137 + day.day_number}`}
                cycleUsedBeforeToday={cycleUsedBeforeToday}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
