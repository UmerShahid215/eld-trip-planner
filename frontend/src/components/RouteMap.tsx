import { useEffect, useMemo } from "react";
import L, { type LatLngExpression, type LatLngTuple } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { Trip } from "../types";
import { STOP_META, formatClock, formatMiles } from "../lib/duty";

function pin(color: string, glyph: string, size = 26) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);background:${color};
      border:2px solid #fff;box-shadow:0 2px 6px rgba(12,21,38,.35);
      display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:#fff;font:700 ${
          glyph.length > 1 ? 8 : 11
        }px Inter,sans-serif;">${glyph}</span>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function FitBounds({ points }: { points: LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 6);
    }
  }, [map, points]);
  return null;
}

export default function RouteMap({ trip }: { trip: Trip }) {
  const line: LatLngTuple[] = useMemo(
    () => trip.route_geometry.map(([lng, lat]) => [lat, lng] as LatLngTuple),
    [trip.route_geometry],
  );

  const endpoints = [
    { lat: trip.current_lat, lng: trip.current_lng, color: "#1e3050", glyph: "S", title: "Start", label: trip.current_location },
    { lat: trip.pickup_lat, lng: trip.pickup_lng, color: STOP_META.pickup.color, glyph: STOP_META.pickup.glyph, title: "Pickup", label: trip.pickup_location },
    { lat: trip.dropoff_lat, lng: trip.dropoff_lng, color: STOP_META.dropoff.color, glyph: STOP_META.dropoff.glyph, title: "Drop-off", label: trip.dropoff_location },
  ].filter((e) => e.lat != null && e.lng != null);

  const midStops = trip.stops.filter(
    (s) => ["fuel", "rest", "restart", "break"].includes(s.type) && s.lat != null && s.lng != null,
  );

  const center: LatLngExpression = line.length ? line[Math.floor(line.length / 2)] : [39.5, -98.35];

  return (
    <MapContainer
      center={center}
      zoom={5}
      scrollWheelZoom
      className="h-full w-full"
      style={{ minHeight: 420 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={line.length ? line : endpoints.map((e) => [e.lat!, e.lng!])} />

      {line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: "#0c1526", weight: 7, opacity: 0.25 }} />
          <Polyline positions={line} pathOptions={{ color: "#f59e0b", weight: 3.5, opacity: 0.95 }} />
        </>
      )}

      {midStops.map((s, i) => {
        const meta = STOP_META[s.type];
        return (
          <Marker key={`stop-${i}`} position={[s.lat!, s.lng!]} icon={pin(meta.color, meta.glyph, 22)}>
            <Popup>
              <strong>{meta.label}</strong>
              <br />
              Mile {formatMiles(s.mile_marker)}
              <br />
              {formatClock(s.start_hour % 24)}–{formatClock(s.end_hour % 24)} · day {Math.floor(s.start_hour / 24) + 1}
            </Popup>
          </Marker>
        );
      })}

      {endpoints.map((e, i) => (
        <Marker key={`end-${i}`} position={[e.lat!, e.lng!]} icon={pin(e.color, e.glyph, 30)}>
          <Popup>
            <strong>{e.title}</strong>
            <br />
            {e.label}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
