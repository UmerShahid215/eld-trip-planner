import type { Trip, TripInput } from "../types";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:8000";

export class ApiError extends Error {}

export async function planTrip(input: TripInput): Promise<Trip> {
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/api/trips/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check that the backend is running and reachable.",
    );
  }

  if (!resp.ok) {
    let detail = `Request failed (${resp.status}).`;
    try {
      const body = await resp.json();
      detail =
        body.detail ||
        (typeof body === "object"
          ? Object.entries(body)
              .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
              .join(" · ")
          : detail);
    } catch {
      /* keep default */
    }
    throw new ApiError(detail);
  }

  return (await resp.json()) as Trip;
}

export async function getTrip(id: number | string): Promise<Trip> {
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/api/trips/${id}/`);
  } catch {
    throw new ApiError("Could not reach the server.");
  }
  if (!resp.ok) {
    throw new ApiError(resp.status === 404 ? "Trip not found." : `Request failed (${resp.status}).`);
  }
  return (await resp.json()) as Trip;
}

export { API_BASE_URL };
