import { useEffect, useState } from "react";
import TripForm from "./components/TripForm";
import ResultsView from "./components/ResultsView";
import { ApiError, getTrip, planTrip } from "./api/client";
import type { Trip, TripInput } from "./types";

export default function App() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load a previously computed trip from a shareable ?trip=<id> URL.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("trip");
    if (!id) return;
    setLoading(true);
    getTrip(id)
      .then(setTrip)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load trip."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(input: TripInput) {
    setLoading(true);
    setError(null);
    try {
      const result = await planTrip(input);
      setTrip(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
      setTrip(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-steel-200/70 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-amber-400 shadow-card">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" strokeLinejoin="round" />
              <circle cx="7" cy="17" r="1.6" fill="currentColor" />
              <circle cx="17.5" cy="17" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight text-ink">
              RouteLog<span className="text-amber-500">.</span>
            </h1>
            <p className="text-xs text-steel-500">
              FMCSA-compliant trip planner &amp; ELD daily-log generator
            </p>
          </div>
          <span className="ml-auto hidden rounded-full border border-steel-200 bg-steel-50 px-3 py-1 text-[11px] font-semibold text-steel-600 sm:inline">
            Property-carrying · 70 hr / 8 day
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-steel-200 bg-white p-5 shadow-card">
            <h2 className="mb-1 text-base font-bold text-ink">Plan a trip</h2>
            <p className="mb-4 text-xs text-steel-500">
              Enter your route and hours already used in the current cycle. We compute the
              HOS-compliant schedule and draw the log sheets.
            </p>
            <TripForm onSubmit={handleSubmit} loading={loading} />
            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700">
                {error}
              </div>
            )}
          </div>
        </aside>

        <section>
          {loading && !trip && <LoadingState />}
          {!loading && !trip && !error && <EmptyState />}
          {trip && <ResultsView trip={trip} />}
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-2 text-center text-xs text-steel-400">
        Schedules follow 49 CFR Part 395 (11-hr driving, 14-hr window, 30-min break,
        70-hr/8-day, 34-hr restart). Distances via {""}
        <span className="font-medium">OpenRouteService driving-hgv</span> / OSRM. Geocoding via Nominatim.
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-dashed border-steel-300 bg-white/50 p-10 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-steel-100 text-steel-400">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" strokeLinejoin="round" />
            <circle cx="7" cy="17" r="1.6" />
            <circle cx="17.5" cy="17" r="1.6" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-ink">Your route &amp; logs will appear here</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-steel-500">
          Fill in the trip form and we&apos;ll map the route, place fuel and rest stops,
          and generate a filled-out daily log sheet for every day of the trip.
        </p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid h-full min-h-[420px] place-items-center rounded-2xl border border-steel-200 bg-white/60 p-10 text-center">
      <div>
        <span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
        <h3 className="text-base font-bold text-ink">Computing HOS-compliant schedule…</h3>
        <p className="mt-1 text-sm text-steel-500">Geocoding locations, routing legs, and drawing logs.</p>
      </div>
    </div>
  );
}
