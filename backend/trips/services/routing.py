"""Route + distance/duration lookup, abstracted behind an interface.

Default provider is OpenRouteService with the ``driving-hgv`` (heavy-goods
vehicle) profile — more realistic for a commercial truck than a car profile.
OSRM's public demo server is the automatic fallback (and the keyless path for
local development). Providers are swappable without touching the HOS engine or
the views.
"""
from __future__ import annotations

import abc
import math
from dataclasses import dataclass, field
from typing import List

import requests
from django.conf import settings

from .geocoding import GeoPoint

_METERS_PER_MILE = 1609.344
_SECONDS_PER_HOUR = 3600.0

# Estimator fallback tuning (used only when live providers are unreachable).
_ROAD_CIRCUITY_FACTOR = 1.25   # roads are longer than straight-line distance
_ESTIMATE_AVG_MPH = 55.0       # typical sustained CMV highway speed


class RoutingError(Exception):
    """Raised when a route cannot be computed."""


@dataclass
class RouteLeg:
    miles: float
    hours: float
    # Polyline as [[lng, lat], ...].
    geometry: List[List[float]] = field(default_factory=list)


class RoutingService(abc.ABC):
    name = "base"

    @abc.abstractmethod
    def route(self, origin: GeoPoint, destination: GeoPoint) -> RouteLeg:
        ...


class ORSRouter(RoutingService):
    name = "openrouteservice-hgv"

    def __init__(self) -> None:
        self.url = settings.ORS_URL.rstrip("/") + "/geojson"
        self.api_key = settings.ORS_API_KEY
        self.timeout = settings.ROUTING_TIMEOUT

    def route(self, origin: GeoPoint, destination: GeoPoint) -> RouteLeg:
        if not self.api_key:
            raise RoutingError("ORS API key is not configured.")
        try:
            resp = requests.post(
                self.url,
                json={"coordinates": [[origin.lng, origin.lat], [destination.lng, destination.lat]]},
                headers={"Authorization": self.api_key, "Content-Type": "application/json"},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            feature = data["features"][0]
            summary = feature["properties"]["summary"]
            return RouteLeg(
                miles=round(summary["distance"] / _METERS_PER_MILE, 1),
                hours=round(summary["duration"] / _SECONDS_PER_HOUR, 3),
                geometry=feature["geometry"]["coordinates"],
            )
        except (requests.RequestException, KeyError, IndexError, ValueError) as exc:
            raise RoutingError(f"OpenRouteService routing failed: {exc}") from exc


class OSRMRouter(RoutingService):
    name = "osrm-demo"

    def __init__(self) -> None:
        self.base = settings.OSRM_URL.rstrip("/")
        self.timeout = settings.ROUTING_TIMEOUT

    def route(self, origin: GeoPoint, destination: GeoPoint) -> RouteLeg:
        coords = f"{origin.lng},{origin.lat};{destination.lng},{destination.lat}"
        try:
            resp = requests.get(
                f"{self.base}/{coords}",
                params={"overview": "full", "geometries": "geojson"},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != "Ok" or not data.get("routes"):
                raise RoutingError(f"OSRM could not route between the points: {data.get('code')}")
            route = data["routes"][0]
            return RouteLeg(
                miles=round(route["distance"] / _METERS_PER_MILE, 1),
                hours=round(route["duration"] / _SECONDS_PER_HOUR, 3),
                geometry=route["geometry"]["coordinates"],
            )
        except (requests.RequestException, KeyError, IndexError, ValueError) as exc:
            raise RoutingError(f"OSRM routing failed: {exc}") from exc


class HaversineRouter(RoutingService):
    """Last-resort estimator: great-circle distance x a road-circuity factor.

    Not a real road route — used only when every live routing provider is
    unreachable, so the app degrades to a labelled estimate instead of failing.
    """

    name = "estimated-straight-line"

    def route(self, origin: GeoPoint, destination: GeoPoint) -> RouteLeg:
        r = 3958.7613  # earth radius, miles
        lat1, lon1, lat2, lon2 = map(math.radians, [origin.lat, origin.lng, destination.lat, destination.lng])
        d = 2 * r * math.asin(math.sqrt(
            math.sin((lat2 - lat1) / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
        ))
        miles = round(d * _ROAD_CIRCUITY_FACTOR, 1)
        hours = round(miles / _ESTIMATE_AVG_MPH, 3) if miles else 0.0
        # A few interpolated points so the map still draws a polyline.
        geometry = [
            [origin.lng + (destination.lng - origin.lng) * t,
             origin.lat + (destination.lat - origin.lat) * t]
            for t in (0.0, 0.25, 0.5, 0.75, 1.0)
        ]
        return RouteLeg(miles=miles, hours=hours, geometry=geometry)


class ChainRouter(RoutingService):
    """Try each provider in order; use the first that succeeds."""

    def __init__(self, providers: List[RoutingService]) -> None:
        self.providers = providers
        self.name = providers[0].name if providers else "none"

    def route(self, origin: GeoPoint, destination: GeoPoint) -> RouteLeg:
        last_error: RoutingError = RoutingError("No routing provider configured.")
        for provider in self.providers:
            try:
                leg = provider.route(origin, destination)
                self.name = provider.name
                return leg
            except RoutingError as exc:
                last_error = exc
        raise last_error


def get_router() -> RoutingService:
    """Build the routing chain: ORS (driving-hgv) first when a key is set, then
    the OSRM demo, then a straight-line estimator so the app never hard-fails."""
    providers: List[RoutingService] = []
    if settings.ORS_API_KEY:
        providers.append(ORSRouter())
    providers.append(OSRMRouter())
    if settings.ENABLE_ESTIMATE_FALLBACK:
        providers.append(HaversineRouter())
    return ChainRouter(providers)
