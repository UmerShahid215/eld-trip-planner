"""Address -> (lat, lng) geocoding, abstracted behind an interface.

Primary: ORS Pelias geocoder (uses the same API key as routing, no extra quota).
Fallback: OpenStreetMap Nominatim (free, no key, ~1 req/sec fair-use limit).
Results are cached by normalised address to minimise outbound requests.
"""
from __future__ import annotations

import abc
import time
from dataclasses import dataclass
from typing import Dict, List

import requests
from django.conf import settings
from django.core.cache import cache


class GeocodingError(Exception):
    """Raised when an address cannot be geocoded."""


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lng: float
    display_name: str = ""


def _normalise(address: str) -> str:
    return " ".join(address.lower().split())


class GeocodingService(abc.ABC):
    @abc.abstractmethod
    def geocode(self, address: str) -> GeoPoint:
        ...


class ORSGeocoder(GeocodingService):
    """Pelias geocoder via OpenRouteService — uses the same API key as routing."""

    name = "ors-geocoder"
    _URL = "https://api.openrouteservice.org/geocode/search"

    def __init__(self) -> None:
        self.api_key = getattr(settings, "ORS_API_KEY", "")
        self.timeout = getattr(settings, "ROUTING_TIMEOUT", 20)
        self._local: Dict[str, GeoPoint] = {}

    def geocode(self, address: str) -> GeoPoint:
        if not self.api_key:
            raise GeocodingError("ORS_API_KEY not configured.")
        if not address or not address.strip():
            raise GeocodingError("Address is empty.")

        key = f"geocode:ors:{_normalise(address)}"
        cached = cache.get(key) or self._local.get(key)
        if cached:
            return cached

        try:
            resp = requests.get(
                self._URL,
                params={"api_key": self.api_key, "text": address, "size": 1},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            raise GeocodingError(f"ORS geocoding unavailable: {exc}") from exc
        except ValueError as exc:
            raise GeocodingError("ORS geocoding returned an invalid response.") from exc

        features = data.get("features", [])
        if not features:
            raise GeocodingError(f"Could not find location: '{address}'.")

        coords = features[0]["geometry"]["coordinates"]  # [lng, lat]
        label = features[0].get("properties", {}).get("label", address)
        point = GeoPoint(lat=float(coords[1]), lng=float(coords[0]), display_name=label)
        cache.set(key, point, timeout=None)
        self._local[key] = point
        return point


class NominatimGeocoder(GeocodingService):
    """OSM Nominatim — free, no key, but rate-limited to ~1 req/sec."""

    name = "nominatim"

    def __init__(self) -> None:
        self.url = getattr(settings, "NOMINATIM_URL", "https://nominatim.openstreetmap.org/search")
        self.user_agent = getattr(settings, "NOMINATIM_USER_AGENT", "eld-trip-planner/1.0")
        self.timeout = getattr(settings, "ROUTING_TIMEOUT", 20)
        self._local: Dict[str, GeoPoint] = {}

    def geocode(self, address: str) -> GeoPoint:
        if not address or not address.strip():
            raise GeocodingError("Address is empty.")

        key = f"geocode:nom:{_normalise(address)}"
        cached = cache.get(key) or self._local.get(key)
        if cached:
            return cached

        last_exc: Exception | None = None
        for attempt in range(3):
            if attempt:
                time.sleep(2 ** attempt)  # 2s, 4s backoff
            try:
                resp = requests.get(
                    self.url,
                    params={"q": address, "format": "json", "limit": 1},
                    headers={"User-Agent": self.user_agent},
                    timeout=self.timeout,
                )
                if resp.status_code == 429:
                    last_exc = GeocodingError(
                        f"Nominatim rate-limited (429) for '{address}'."
                    )
                    continue
                resp.raise_for_status()
                data = resp.json()
            except GeocodingError:
                raise
            except requests.RequestException as exc:
                raise GeocodingError(f"Geocoding service unavailable: {exc}") from exc
            except ValueError as exc:
                raise GeocodingError("Geocoding service returned an invalid response.") from exc

            if not data:
                raise GeocodingError(f"Could not find location: '{address}'.")

            top = data[0]
            point = GeoPoint(
                lat=float(top["lat"]),
                lng=float(top["lon"]),
                display_name=top.get("display_name", address),
            )
            cache.set(key, point, timeout=None)
            self._local[key] = point
            return point

        raise last_exc or GeocodingError(f"Geocoding failed for '{address}'.")


class ChainGeocoder(GeocodingService):
    """Try each provider in order; use the first that succeeds."""

    def __init__(self, providers: List[GeocodingService]) -> None:
        self._providers = providers

    def geocode(self, address: str) -> GeoPoint:
        last_exc: Exception | None = None
        for provider in self._providers:
            try:
                return provider.geocode(address)
            except GeocodingError as exc:
                last_exc = exc
        raise last_exc or GeocodingError(f"All geocoders failed for '{address}'.")


def get_geocoder() -> GeocodingService:
    """Build the provider chain: ORS (if key present) → Nominatim."""
    providers: List[GeocodingService] = []
    if getattr(settings, "ORS_API_KEY", ""):
        providers.append(ORSGeocoder())
    providers.append(NominatimGeocoder())
    return ChainGeocoder(providers)
