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
      <header className="sticky top-0 z-[1200] border-b border-steel-200/70 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-ink-700 to-ink text-amber-400 shadow-card ring-1 ring-white/10">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" strokeLinejoin="round" />
              <circle cx="7" cy="17" r="1.6" fill="currentColor" />
              <circle cx="17.5" cy="17" r="1.6" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight text-ink">
              RouteLog<span className="text-amber-500">.</span>
            </h1>
            <p className="text-xs text-steel-500">
              FMCSA-compliant trip planner &amp; ELD daily-log generator
            </p>
          </div>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-steel-200 bg-steel-50 px-3 py-1 text-[11px] font-semibold text-steel-600 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-duty-onduty" aria-hidden />
            Property-carrying · 70 hr / 8 day
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-[76px] lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-card">
            <div className="border-b border-steel-100 bg-gradient-to-b from-steel-50/80 to-transparent px-5 pb-3 pt-4">
              <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Plan a trip
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-steel-500">
                Enter your route and hours already used in the current cycle. We compute the
                HOS-compliant schedule and draw the log sheets.
              </p>
            </div>
            <div className="p-5">
            <TripForm onSubmit={handleSubmit} loading={loading} />
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-700"
              >
                <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            </div>
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
  const steps = [
    { n: "1", t: "Map the route", d: "HGV-legal roads, both legs" },
    { n: "2", t: "Place stops", d: "Fuel, 30-min breaks, 10-hr resets" },
    { n: "3", t: "Draw the logs", d: "A certified grid for each day" },
  ];
  return (
    <div className="grid h-full min-h-[440px] place-items-center rounded-2xl border border-dashed border-steel-300 bg-white/50 p-8 text-center animate-fade-up">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-ink-700 to-ink text-amber-400 shadow-card ring-1 ring-white/10">
          <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" strokeLinejoin="round" />
            <circle cx="7" cy="17" r="1.6" />
            <circle cx="17.5" cy="17" r="1.6" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-ink">Your route &amp; logs will appear here</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-steel-500">
          Enter a trip on the left. We compute an Hours-of-Service compliant plan and
          render a filled-out ELD daily log for every day.
        </p>
        <div className="mt-6 grid gap-2.5 text-left sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.n}
              className="rounded-xl border border-steel-200 bg-white p-3 shadow-card"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-amber-100 text-xs font-bold text-amber-600">
                {s.n}
              </span>
              <div className="mt-2 text-sm font-semibold text-ink">{s.t}</div>
              <div className="mt-0.5 text-xs text-steel-500">{s.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3 overflow-hidden rounded-2xl border border-steel-200 bg-white shadow-card">
          <div className="border-b border-steel-200 px-4 py-3">
            <Shimmer className="h-4 w-32" />
          </div>
          <div className="relative grid h-[420px] place-items-center overflow-hidden bg-steel-100">
            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            <div className="relative text-center">
              <span className="mx-auto mb-3 block h-9 w-9 animate-spin rounded-full border-4 border-amber-200 border-t-amber-500" />
              <p className="text-sm font-semibold text-steel-500">Routing the trip…</p>
            </div>
          </div>
        </div>
        <div className="space-y-3 lg:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-steel-200 bg-white p-3.5 shadow-card">
                <Shimmer className="h-3 w-16" />
                <Shimmer className="mt-2 h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-steel-200 bg-white p-4 shadow-card">
            <Shimmer className="h-4 w-28" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Shimmer key={i} className="h-6 w-20 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-steel-200 bg-paper p-5 shadow-card">
        <div className="flex items-center justify-between">
          <Shimmer className="h-5 w-40" />
          <Shimmer className="h-8 w-16 rounded-lg" />
        </div>
        <Shimmer className="mt-4 h-40 w-full rounded-lg" />
        <p className="mt-3 text-center text-xs font-medium text-steel-400">
          Geocoding locations, routing legs, and drawing the duty grid…
        </p>
      </div>
    </div>
  );
}

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative block overflow-hidden rounded bg-steel-100 ${className}`}
      aria-hidden
    >
      <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/70 to-transparent" />
    </span>
  );
}
