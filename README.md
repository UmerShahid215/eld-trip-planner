# RouteLog — Trip Planner + ELD Log Generator

A full-stack app for property-carrying truck drivers. Enter a trip (current →
pickup → drop-off + hours already used in your cycle) and it computes an
**FMCSA Hours-of-Service–compliant** schedule, maps the route with fuel/rest
stops, and draws a filled-out **Daily Log (ELD) sheet for every day** of the trip.

- **Backend:** Django + Django REST Framework, Postgres
- **Frontend:** React + TypeScript + Vite + Tailwind, Leaflet map, SVG log sheets
- **HOS engine:** a pure, dependency-free Python module, unit-tested against the
  FMCSA guide's own worked examples

---

## Table of contents
- [Architecture](#architecture)
- [The HOS engine](#the-hos-engine)
- [Local development](#local-development)
- [API](#api)
- [Testing](#testing)
- [Deployment](#deployment)
- [HOS rules & assumptions](#hos-rules--assumptions)
- [Known limitations](#known-limitations)

---

## Architecture

```
backend/
  hos_engine/          Pure Python HOS state machine (ZERO Django deps)
    constants.py       11h / 14h / 8h / 10h / 70h / 34h, fuel & pickup/dropoff
    models.py          DutyStatus, DutySegment, DutyDay, StopEvent, ScheduleResult
    engine.py          build_schedule(...) — the simulation
  trips/
    models.py          Trip, DutyDay, DutySegment, Stop
    serializers.py     DRF (in)/(out) serializers
    views.py           TripViewSet: POST/GET /api/trips, GET .../logs
    services/
      geocoding.py     GeocodingService  -> NominatimGeocoder (cached)
      routing.py       RoutingService    -> ORS (hgv) → OSRM → straight-line chain
      planner.py       Orchestration: geocode → route → engine → persist
    management/commands/seed_demo.py   Offline demo-trip seeder
  config/              Django project (settings, urls, wsgi)
  tests/               pytest: engine tests + DRF API tests
frontend/
  src/components/      TripForm, ResultsView, RouteMap, TripSummary, LogSheet
  src/lib/             duty-status metadata + formatting helpers
  src/api/client.ts    typed fetch wrapper
```

**Design principle:** the HOS engine is a standalone, testable module with no
framework dependencies. Geocoding and routing sit behind interfaces
(`GeocodingService` / `RoutingService`), so providers can be swapped without
touching the engine or the views.

---

## The HOS engine

`hos_engine.build_schedule(...)` plays the trip forward on a virtual clock,
inserting the breaks, fuel stops, resets and restarts that the rules require:

```python
from hos_engine import build_schedule

result = build_schedule(
    current_to_pickup_miles=480, current_to_pickup_drive_hours=8.0,
    pickup_to_dropoff_miles=1260, pickup_to_dropoff_drive_hours=20.0,
    cycle_used_hours=8.0,
)
result.total_days          # -> 3
result.days[0].totals_by_status()
result.stops               # pickup / fuel / rest / restart / dropoff w/ mile markers
```

It is validated **first** against the FMCSA *Interstate Truck Driver's Guide to
Hours of Service* worked examples (see `backend/tests/hos_engine/test_engine.py`):

- the **"John Doe" completed daily log** (7.75 driving / 4.5 on-duty / 1.75
  sleeper / 10 off = 24 h) — validates segment building & totals, and
- the **rolling 8-day total** table (67 / 73 / 63) — validates the 70/8 accumulator.

---

## Local development

### Prerequisites
- Python 3.9+ and Node 18+.

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # add ORS_API_KEY for real HGV routing (optional)
python manage.py migrate
python manage.py runserver      # http://localhost:8000
```

Seed a demo trip **without any network** (handy offline / for screenshots):
```bash
python manage.py seed_demo      # prints a trip id → open /?trip=<id> in the UI
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env            # VITE_API_BASE_URL=http://localhost:8000
npm run dev                     # http://localhost:5173
```

### Or with Docker (backend + Postgres)
```bash
docker compose up --build       # backend on :8000, Postgres on :5432
# then run the frontend with `cd frontend && npm run dev`
```

---

## API

| Method | Path                    | Description |
|-------:|-------------------------|-------------|
| POST   | `/api/trips/`           | Compute + persist a trip. Body: `current_location`, `pickup_location`, `dropoff_location`, `current_cycle_used_hours`. Returns the full trip (route geometry, per-day segments, stops). |
| GET    | `/api/trips/{id}/`      | Retrieve a previously computed trip. |
| GET    | `/api/trips/{id}/logs/` | Per-day duty segments + totals, formatted for the log-sheet renderer. |
| GET    | `/api/health/`          | Health check. |

```bash
curl -X POST http://localhost:8000/api/trips/ \
  -H "Content-Type: application/json" \
  -d '{"current_location":"Richmond, VA","pickup_location":"Columbus, OH","dropoff_location":"Denver, CO","current_cycle_used_hours":8}'
```

Errors return `400` with a clear `{"detail": "..."}` message: location not found,
routing failure, or `current_cycle_used_hours` outside 0–70.

---

## Testing

```bash
# Backend (engine + API)
cd backend && source .venv/bin/activate && pytest -q     # 19 tests

# Frontend (form + log-sheet renderer)
cd frontend && npm test                                  # 9 tests
```

---

## Deployment

The backend deploys to **Render/Railway** (Docker + Postgres); the frontend to
**Vercel**.

### Backend → Render (Blueprint)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point at the repo. `render.yaml` provisions a
   Dockerized web service (`rootDir: backend`) + a free Postgres database.
3. After the first deploy, set env vars: `DJANGO_ALLOWED_HOSTS` (your
   `*.onrender.com` host), `CORS_ALLOWED_ORIGINS` (your Vercel URL),
   `ORS_API_KEY` (from [openrouteservice.org](https://openrouteservice.org/dev/#/signup)).
   `DATABASE_URL` and `DJANGO_SECRET_KEY` are wired automatically.

### Frontend → Vercel
1. **New Project → import the repo**, set **Root Directory = `frontend`**.
2. Framework preset **Vite** (build `npm run build`, output `dist`).
3. Add env var `VITE_API_BASE_URL = https://<your-backend>.onrender.com`.
4. Deploy. `vercel.json` handles SPA routing.

Make sure the backend's `CORS_ALLOWED_ORIGINS` includes the Vercel domain.

---

## HOS rules & assumptions

Implemented from 49 CFR Part 395 / FMCSA guide, **property-carrying, 70 h/8 day**:

1. **11-hour** driving limit per duty period.
2. **14-hour** on-duty window — driving stops at hour 14; breaks do **not** extend it.
3. **30-minute break** required after 8 cumulative driving hours (off-duty,
   sleeper, or on-duty-not-driving all qualify).
4. **10 consecutive hours off duty** resets the 11 h & 14 h clocks.
5. **70-hour / 8-day** rolling on-duty limit; the driver can't drive at/over 70.
6. **34-hour restart** — inserted automatically when the remaining cycle would
   otherwise strand the driver; resets the accumulator to zero.
7. **Fuel** stop (30 min on-duty) every **1,000 miles**.
8. **1 hour on-duty** each for **pickup** and **drop-off**.

Fixed business assumptions (not configurable, per the brief): property-carrying
driver on the 70/8 cycle, no adverse-driving exception, simple 10-hours-off model
(no 7/3 or 8/2 sleeper-berth split).

---

## Known limitations

- **Trip start time.** Each trip is modelled starting at midnight of day 1
  (driver assumed rested). Real logs may start mid-day; this keeps day
  boundaries clean and doesn't affect the hours math.
- **70/8 rolling window.** The API receives only a single scalar
  `current_cycle_used_hours`, not a per-day breakdown of the prior 7 days, so the
  engine treats it as a conservative running total that only resets on a 34-hour
  restart. The full rolling-window accumulator is implemented and tested
  separately (`rolling_8day_on_duty_totals`) against the FMCSA table.
- **Routing provider.** Production uses OpenRouteService `driving-hgv`
  (realistic for a CMV) when `ORS_API_KEY` is set. Without a key it uses the
  public OSRM demo. If **both** are unreachable, the app degrades to a clearly
  **labelled straight-line estimate** (`routing: estimated-straight-line`) rather
  than failing — accurate hosted results should always run with an ORS key.
- **Geocoding** uses Nominatim (fair-use ~1 req/s); results are cached by
  normalized address.
