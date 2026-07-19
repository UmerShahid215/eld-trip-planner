"""Orchestrates a trip computation: geocode -> route -> HOS engine -> persist.

Kept separate from the DRF view so it can be unit-tested with injected fake
geocoder/router implementations (no network in tests).
"""
from __future__ import annotations

import datetime
from typing import List, Optional

from django.db import transaction

from hos_engine import build_schedule

from ..models import DutyDay, DutySegment, Stop, Trip
from .geocoding import GeocodingService, GeoPoint
from .routing import RouteLeg, RoutingService


def _point_at_fraction(geometry: List[List[float]], fraction: float) -> Optional[List[float]]:
    """Interpolate an [lng, lat] point at a fraction (0..1) of a polyline's length."""
    if not geometry:
        return None
    if len(geometry) == 1:
        return geometry[0]
    fraction = max(0.0, min(1.0, fraction))

    seg_lengths = []
    total = 0.0
    for i in range(len(geometry) - 1):
        (x1, y1), (x2, y2) = geometry[i], geometry[i + 1]
        d = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5
        seg_lengths.append(d)
        total += d
    if total == 0:
        return geometry[0]

    target = fraction * total
    acc = 0.0
    for i, d in enumerate(seg_lengths):
        if acc + d >= target:
            t = 0.0 if d == 0 else (target - acc) / d
            (x1, y1), (x2, y2) = geometry[i], geometry[i + 1]
            return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
        acc += d
    return geometry[-1]


@transaction.atomic
def plan_trip(
    *,
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    current_cycle_used_hours: float,
    geocoder: GeocodingService,
    router: RoutingService,
) -> Trip:
    current = geocoder.geocode(current_location)
    pickup = geocoder.geocode(pickup_location)
    dropoff = geocoder.geocode(dropoff_location)

    leg1: RouteLeg = router.route(current, pickup)
    leg2: RouteLeg = router.route(pickup, dropoff)

    schedule = build_schedule(
        current_to_pickup_miles=leg1.miles,
        current_to_pickup_drive_hours=leg1.hours,
        pickup_to_dropoff_miles=leg2.miles,
        pickup_to_dropoff_drive_hours=leg2.hours,
        cycle_used_hours=current_cycle_used_hours,
    )

    combined_geometry = list(leg1.geometry) + list(leg2.geometry)

    trip = Trip.objects.create(
        current_location=current_location,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        current_cycle_used_hours=current_cycle_used_hours,
        current_lat=current.lat, current_lng=current.lng,
        pickup_lat=pickup.lat, pickup_lng=pickup.lng,
        dropoff_lat=dropoff.lat, dropoff_lng=dropoff.lng,
        leg1_miles=leg1.miles, leg1_hours=leg1.hours,
        leg2_miles=leg2.miles, leg2_hours=leg2.hours,
        total_miles=schedule.total_miles,
        total_drive_hours=schedule.total_drive_hours,
        total_on_duty_hours=schedule.total_on_duty_hours,
        total_duration_hours=schedule.total_duration_hours,
        total_days=schedule.total_days,
        route_geometry=combined_geometry,
        routing_provider=getattr(router, "name", ""),
    )

    start_date = trip.created_at.date() if trip.created_at else datetime.date.today()
    for day in schedule.days:
        duty_day = DutyDay.objects.create(
            trip=trip,
            day_number=day.day_number,
            date=start_date + datetime.timedelta(days=day.day_number - 1),
        )
        DutySegment.objects.bulk_create([
            DutySegment(
                duty_day=duty_day,
                start_hour=seg.start_hour,
                end_hour=seg.end_hour,
                status=seg.status.value,
                location_label=seg.location_label,
            )
            for seg in day.segments
        ])

    total_miles = schedule.total_miles or 1.0
    stops = []
    for ev in schedule.stops:
        pt = _point_at_fraction(combined_geometry, ev.mile_marker / total_miles)
        stops.append(Stop(
            trip=trip,
            type=ev.type.value,
            label=ev.label,
            mile_marker=ev.mile_marker,
            start_hour=ev.start_hour,
            end_hour=ev.end_hour,
            lng=pt[0] if pt else None,
            lat=pt[1] if pt else None,
        ))
    Stop.objects.bulk_create(stops)

    return trip
