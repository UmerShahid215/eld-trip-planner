export type DutyStatus =
  | "OFF_DUTY"
  | "SLEEPER_BERTH"
  | "DRIVING"
  | "ON_DUTY_NOT_DRIVING";

export type StopType =
  | "pickup"
  | "dropoff"
  | "fuel"
  | "rest"
  | "restart"
  | "break";

export interface DutySegment {
  start_hour: number;
  end_hour: number;
  status: DutyStatus;
  location_label: string;
  duration_hours: number;
}

export interface DutyDay {
  day_number: number;
  date: string | null;
  segments: DutySegment[];
  totals: Record<DutyStatus, number>;
}

export interface Stop {
  type: StopType;
  label: string;
  mile_marker: number;
  start_hour: number;
  end_hour: number;
  lat: number | null;
  lng: number | null;
}

export interface Trip {
  id: number;
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number;
  current_lat: number | null;
  current_lng: number | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  leg1_miles: number;
  leg1_hours: number;
  leg2_miles: number;
  leg2_hours: number;
  total_miles: number;
  total_drive_hours: number;
  total_on_duty_hours: number;
  total_duration_hours: number;
  total_days: number;
  route_geometry: [number, number][]; // [lng, lat]
  routing_provider: string;
  created_at: string;
  days: DutyDay[];
  stops: Stop[];
}

export interface TripInput {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  current_cycle_used_hours: number;
}
