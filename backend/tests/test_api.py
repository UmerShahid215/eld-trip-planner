"""DRF endpoint tests using injected fake geocoder/router (no network)."""
import pytest
from rest_framework.test import APIClient

from trips.services.geocoding import GeocodingError, GeoPoint
from trips.services.routing import RouteLeg, RoutingError

pytestmark = pytest.mark.django_db


class FakeGeocoder:
    """Maps known addresses to coordinates; raises for anything else."""

    _POINTS = {
        "richmond, va": GeoPoint(37.5407, -77.4360, "Richmond, VA"),
        "newark, nj": GeoPoint(40.7357, -74.1724, "Newark, NJ"),
        "philadelphia, pa": GeoPoint(39.9526, -75.1652, "Philadelphia, PA"),
    }

    def geocode(self, address: str) -> GeoPoint:
        try:
            return self._POINTS[address.strip().lower()]
        except KeyError:
            raise GeocodingError(f"Could not find location: '{address}'.")


class FakeRouter:
    name = "fake"

    def route(self, origin, destination) -> RouteLeg:
        geometry = [[origin.lng, origin.lat], [destination.lng, destination.lat]]
        return RouteLeg(miles=120.0, hours=2.0, geometry=geometry)


class BoomRouter:
    name = "boom"

    def route(self, origin, destination) -> RouteLeg:
        raise RoutingError("routing provider is down")


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture(autouse=True)
def patch_services(monkeypatch):
    monkeypatch.setattr("trips.views.NominatimGeocoder", FakeGeocoder)
    monkeypatch.setattr("trips.views.get_router", lambda: FakeRouter())


VALID_PAYLOAD = {
    "current_location": "Richmond, VA",
    "pickup_location": "Philadelphia, PA",
    "dropoff_location": "Newark, NJ",
    "current_cycle_used_hours": 10.0,
}


def test_create_trip_happy_path(client):
    resp = client.post("/api/trips/", VALID_PAYLOAD, format="json")
    assert resp.status_code == 201, resp.content
    body = resp.json()
    assert body["total_miles"] == pytest.approx(240.0)  # two 120-mi legs
    assert body["total_drive_hours"] == pytest.approx(4.0)
    assert body["total_days"] >= 1
    assert len(body["days"]) == body["total_days"]
    stop_types = {s["type"] for s in body["stops"]}
    assert {"pickup", "dropoff"} <= stop_types
    # Each rendered day covers a full 24h.
    for day in body["days"]:
        total = sum(seg["duration_hours"] for seg in day["segments"])
        assert total == pytest.approx(24.0, abs=1e-2)


@pytest.mark.parametrize("bad", [-5, 71, 100])
def test_invalid_cycle_hours_returns_400(client, bad):
    payload = {**VALID_PAYLOAD, "current_cycle_used_hours": bad}
    resp = client.post("/api/trips/", payload, format="json")
    assert resp.status_code == 400


def test_missing_field_returns_400(client):
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "dropoff_location"}
    resp = client.post("/api/trips/", payload, format="json")
    assert resp.status_code == 400


def test_geocoding_failure_returns_400(client):
    payload = {**VALID_PAYLOAD, "current_location": "Nowhere Land XYZ"}
    resp = client.post("/api/trips/", payload, format="json")
    assert resp.status_code == 400
    assert "Could not find" in resp.json()["detail"]


def test_routing_failure_returns_400(client, monkeypatch):
    monkeypatch.setattr("trips.views.get_router", lambda: BoomRouter())
    resp = client.post("/api/trips/", VALID_PAYLOAD, format="json")
    assert resp.status_code == 400
    assert "down" in resp.json()["detail"]


def test_retrieve_and_logs(client):
    created = client.post("/api/trips/", VALID_PAYLOAD, format="json").json()
    trip_id = created["id"]

    got = client.get(f"/api/trips/{trip_id}/")
    assert got.status_code == 200
    assert got.json()["id"] == trip_id

    logs = client.get(f"/api/trips/{trip_id}/logs/")
    assert logs.status_code == 200
    body = logs.json()
    assert body["trip_id"] == trip_id
    assert len(body["days"]) == body["total_days"]
    assert "totals" in body["days"][0]
