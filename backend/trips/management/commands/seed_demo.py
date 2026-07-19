"""Seed a demo trip fully offline (no geocoding/routing network calls).

Useful for local development, screenshots and CI where external providers may be
unavailable. Uses a tiny built-in city gazetteer plus the straight-line
estimator, so it never touches the network.

    python manage.py seed_demo
    python manage.py seed_demo --current "Richmond, VA" --pickup "Columbus, OH" \
        --dropoff "Denver, CO" --cycle 8
"""
from django.core.management.base import BaseCommand, CommandError

from trips.services.geocoding import GeoPoint
from trips.services.planner import plan_trip
from trips.services.routing import HaversineRouter

GAZETTEER = {
    "richmond, va": GeoPoint(37.5407, -77.4360, "Richmond, VA"),
    "columbus, oh": GeoPoint(39.9612, -82.9988, "Columbus, OH"),
    "denver, co": GeoPoint(39.7392, -104.9903, "Denver, CO"),
    "newark, nj": GeoPoint(40.7357, -74.1724, "Newark, NJ"),
    "philadelphia, pa": GeoPoint(39.9526, -75.1652, "Philadelphia, PA"),
    "chicago, il": GeoPoint(41.8781, -87.6298, "Chicago, IL"),
    "dallas, tx": GeoPoint(32.7767, -96.7970, "Dallas, TX"),
    "los angeles, ca": GeoPoint(34.0522, -118.2437, "Los Angeles, CA"),
}


class _GazetteerGeocoder:
    def geocode(self, address: str) -> GeoPoint:
        point = GAZETTEER.get(address.strip().lower())
        if not point:
            raise CommandError(
                f"'{address}' is not in the offline gazetteer. Known: "
                + ", ".join(sorted(GAZETTEER))
            )
        return point


class Command(BaseCommand):
    help = "Create a demo trip offline (no network)."

    def add_arguments(self, parser):
        parser.add_argument("--current", default="Richmond, VA")
        parser.add_argument("--pickup", default="Columbus, OH")
        parser.add_argument("--dropoff", default="Denver, CO")
        parser.add_argument("--cycle", type=float, default=8.0)

    def handle(self, *args, **opts):
        trip = plan_trip(
            current_location=opts["current"],
            pickup_location=opts["pickup"],
            dropoff_location=opts["dropoff"],
            current_cycle_used_hours=opts["cycle"],
            geocoder=_GazetteerGeocoder(),
            router=HaversineRouter(),
        )
        self.stdout.write(self.style.SUCCESS(
            f"Seeded demo trip id={trip.id}: {trip.current_location} -> "
            f"{trip.dropoff_location}, {trip.total_miles} mi, {trip.total_days} days.\n"
            f"View at: /?trip={trip.id}"
        ))
