"""Address -> (lat, lng) geocoding, abstracted behind an interface.

Default implementation uses OpenStreetMap Nominatim (free, no key). Results are
cached by normalised address string because they are static and Nominatim's fair
-use policy is ~1 request/second.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Dict, Tuple

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


class NominatimGeocoder(GeocodingService):
    def __init__(self) -> None:
        self.url = settings.NOMINATIM_URL
        self.user_agent = settings.NOMINATIM_USER_AGENT
        self.timeout = settings.ROUTING_TIMEOUT
        # In-process fallback cache (used if Django cache is the dummy backend).
        self._local: Dict[str, GeoPoint] = {}

    def geocode(self, address: str) -> GeoPoint:
        if not address or not address.strip():
            raise GeocodingError("Address is empty.")

        key = f"geocode:{_normalise(address)}"
        cached = cache.get(key) or self._local.get(key)
        if cached:
            return cached

        try:
            resp = requests.get(
                self.url,
                params={"q": address, "format": "json", "limit": 1},
                headers={"User-Agent": self.user_agent},
                timeout=self.timeout,
            )
            resp.raise_for_status()
            data = resp.json()
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
