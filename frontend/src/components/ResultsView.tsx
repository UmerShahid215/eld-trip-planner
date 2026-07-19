import type { Trip } from "../types";
import LogSheet from "./LogSheet";
import RouteMap from "./RouteMap";
import TripSummary from "./TripSummary";

export default function ResultsView({ trip }: { trip: Trip }) {
  const totalDrive = trip.total_drive_hours || 1;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-steel-200 px-4 py-3">
            <h2 className="text-sm font-bold text-ink">Route</h2>
            <span className="text-xs text-steel-500 truncate max-w-[60%]">
              {trip.current_location} → {trip.pickup_location} → {trip.dropoff_location}
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
          <h2 className="text-lg font-bold text-ink">Daily log sheets</h2>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-white">
            {trip.total_days} {trip.total_days === 1 ? "sheet" : "sheets"}
          </span>
        </div>
        <div className="space-y-5">
          {trip.days.map((day) => (
            <LogSheet
              key={day.day_number}
              day={day}
              fromLabel={day.day_number === 1 ? trip.current_location : "En route"}
              toLabel={day.day_number === trip.total_days ? trip.dropoff_location : "En route"}
              milesToday={(trip.total_miles * (day.totals.DRIVING || 0)) / totalDrive}
              totalMilesTrip={trip.total_miles}
              driverCycleUsed={trip.current_cycle_used_hours}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
