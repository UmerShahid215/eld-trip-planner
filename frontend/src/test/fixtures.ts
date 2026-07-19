import type { DutyDay, Trip } from "../types";

export const sampleDay: DutyDay = {
  day_number: 1,
  date: "2026-07-19",
  segments: [
    { start_hour: 0, end_hour: 6, status: "OFF_DUTY", location_label: "Richmond, VA", duration_hours: 6 },
    { start_hour: 6, end_hour: 9, status: "DRIVING", location_label: "Depart", duration_hours: 3 },
    { start_hour: 9, end_hour: 10, status: "ON_DUTY_NOT_DRIVING", location_label: "Fuel stop", duration_hours: 1 },
    { start_hour: 10, end_hour: 14.75, status: "DRIVING", location_label: "", duration_hours: 4.75 },
    { start_hour: 14.75, end_hour: 18.25, status: "ON_DUTY_NOT_DRIVING", location_label: "Drop-off", duration_hours: 3.5 },
    { start_hour: 18.25, end_hour: 20, status: "SLEEPER_BERTH", location_label: "Sleeper", duration_hours: 1.75 },
    { start_hour: 20, end_hour: 24, status: "OFF_DUTY", location_label: "Off duty", duration_hours: 4 },
  ],
  totals: {
    OFF_DUTY: 10,
    SLEEPER_BERTH: 1.75,
    DRIVING: 7.75,
    ON_DUTY_NOT_DRIVING: 4.5,
  },
};

export const sampleTrip: Trip = {
  id: 1,
  current_location: "Richmond, VA",
  pickup_location: "Columbus, OH",
  dropoff_location: "Denver, CO",
  current_cycle_used_hours: 8,
  current_lat: 37.5,
  current_lng: -77.4,
  pickup_lat: 39.9,
  pickup_lng: -83.0,
  dropoff_lat: 39.7,
  dropoff_lng: -105.0,
  leg1_miles: 480,
  leg1_hours: 8,
  leg2_miles: 1260,
  leg2_hours: 20,
  total_miles: 1740,
  total_drive_hours: 28,
  total_on_duty_hours: 30,
  total_duration_hours: 55,
  total_days: 3,
  route_geometry: [
    [-77.4, 37.5],
    [-83.0, 39.9],
    [-105.0, 39.7],
  ],
  routing_provider: "osrm-demo",
  created_at: "2026-07-19T00:00:00Z",
  days: [sampleDay],
  stops: [
    { type: "pickup", label: "Pickup", mile_marker: 480, start_hour: 9, end_hour: 10, lat: 39.9, lng: -83.0 },
    { type: "fuel", label: "Fuel stop", mile_marker: 1000, start_hour: 28, end_hour: 28.5, lat: 39.8, lng: -95.0 },
    { type: "dropoff", label: "Drop-off", mile_marker: 1740, start_hour: 54, end_hour: 55, lat: 39.7, lng: -105.0 },
  ],
};
