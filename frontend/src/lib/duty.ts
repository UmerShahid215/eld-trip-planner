import type { DutyStatus, StopType } from "../types";

// Grid row order, top to bottom, exactly as on an FMCSA daily log.
export const DUTY_ROWS: { status: DutyStatus; label: string; short: string }[] = [
  { status: "OFF_DUTY", label: "1. Off Duty", short: "OFF" },
  { status: "SLEEPER_BERTH", label: "2. Sleeper Berth", short: "SB" },
  { status: "DRIVING", label: "3. Driving", short: "D" },
  { status: "ON_DUTY_NOT_DRIVING", label: "4. On Duty (not driving)", short: "ON" },
];

export const DUTY_COLORS: Record<DutyStatus, string> = {
  OFF_DUTY: "#94a3b8",
  SLEEPER_BERTH: "#6366f1",
  DRIVING: "#f59e0b",
  ON_DUTY_NOT_DRIVING: "#0ea5a4",
};

export const DUTY_LABELS: Record<DutyStatus, string> = {
  OFF_DUTY: "Off duty",
  SLEEPER_BERTH: "Sleeper berth",
  DRIVING: "Driving",
  ON_DUTY_NOT_DRIVING: "On duty (not driving)",
};

export const STOP_META: Record<
  StopType,
  { label: string; color: string; glyph: string }
> = {
  pickup: { label: "Pickup", color: "#0ea5a4", glyph: "P" },
  dropoff: { label: "Drop-off", color: "#dc2626", glyph: "D" },
  fuel: { label: "Fuel", color: "#f59e0b", glyph: "F" },
  rest: { label: "10-hr reset", color: "#6366f1", glyph: "R" },
  restart: { label: "34-hr restart", color: "#7c3aed", glyph: "34" },
  break: { label: "30-min break", color: "#64748b", glyph: "B" },
};

/** 12.5 -> "12h 30m" */
export function formatHours(h: number): string {
  const whole = Math.floor(h + 1e-6);
  const mins = Math.round((h - whole) * 60);
  if (whole === 0) return `${mins}m`;
  if (mins === 0) return `${whole}h`;
  return `${whole}h ${mins}m`;
}

/** 13.5 (hours past midnight) -> "13:30" */
export function formatClock(hoursPastMidnight: number): string {
  const total = Math.round(hoursPastMidnight * 60);
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatMiles(m: number): string {
  return Math.round(m).toLocaleString();
}
