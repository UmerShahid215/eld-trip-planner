import { useState } from "react";
import type { TripInput } from "../types";

interface Props {
  onSubmit: (input: TripInput) => void;
  loading: boolean;
}

type Errors = Partial<Record<keyof TripInput, string>>;

const EXAMPLE: TripInput = {
  current_location: "Richmond, VA",
  pickup_location: "Columbus, OH",
  dropoff_location: "Denver, CO",
  current_cycle_used_hours: 8,
};

export default function TripForm({ onSubmit, loading }: Props) {
  const [current, setCurrent] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [cycle, setCycle] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  function validate(): TripInput | null {
    const next: Errors = {};
    if (!current.trim()) next.current_location = "Enter a starting location.";
    if (!pickup.trim()) next.pickup_location = "Enter a pickup location.";
    if (!dropoff.trim()) next.dropoff_location = "Enter a drop-off location.";
    const hrs = Number(cycle);
    if (cycle.trim() === "" || Number.isNaN(hrs)) {
      next.current_cycle_used_hours = "Enter cycle hours used.";
    } else if (hrs < 0 || hrs > 70) {
      next.current_cycle_used_hours = "Must be between 0 and 70.";
    }
    setErrors(next);
    if (Object.keys(next).length) return null;
    return {
      current_location: current.trim(),
      pickup_location: pickup.trim(),
      dropoff_location: dropoff.trim(),
      current_cycle_used_hours: hrs,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = validate();
    if (input) onSubmit(input);
  }

  function fillExample() {
    setCurrent(EXAMPLE.current_location);
    setPickup(EXAMPLE.pickup_location);
    setDropoff(EXAMPLE.dropoff_location);
    setCycle(String(EXAMPLE.current_cycle_used_hours));
    setErrors({});
  }

  const field =
    "w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-steel-300 " +
    "focus:outline-none focus:ring-2 focus:ring-amber-400/60 transition";

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field
        id="current_location"
        label="Current location"
        placeholder="e.g. Richmond, VA"
        value={current}
        onChange={setCurrent}
        error={errors.current_location}
        className={field}
        icon="●"
        iconColor="#1e3050"
      />
      <Field
        id="pickup_location"
        label="Pickup location"
        placeholder="e.g. Columbus, OH"
        value={pickup}
        onChange={setPickup}
        error={errors.pickup_location}
        className={field}
        icon="P"
        iconColor="#0ea5a4"
      />
      <Field
        id="dropoff_location"
        label="Drop-off location"
        placeholder="e.g. Denver, CO"
        value={dropoff}
        onChange={setDropoff}
        error={errors.dropoff_location}
        className={field}
        icon="D"
        iconColor="#dc2626"
      />

      <div>
        <label htmlFor="current_cycle_used_hours" className="mb-1 block text-sm font-semibold text-ink">
          Current cycle used <span className="font-normal text-steel-400">(hours, 0–70)</span>
        </label>
        <div className="relative">
          <input
            id="current_cycle_used_hours"
            type="number"
            inputMode="decimal"
            min={0}
            max={70}
            step={0.25}
            placeholder="e.g. 8"
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            aria-invalid={!!errors.current_cycle_used_hours}
            className={`${field} tabular pr-14 ${errors.current_cycle_used_hours ? "border-red-400" : "border-steel-200"}`}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-steel-400">
            / 70 hrs
          </span>
        </div>
        {errors.current_cycle_used_hours && (
          <p className="mt-1 text-xs font-medium text-red-500">{errors.current_cycle_used_hours}</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-ink shadow-sm transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
              Planning route…
            </>
          ) : (
            "Plan trip & generate logs"
          )}
        </button>
        <button
          type="button"
          onClick={fillExample}
          disabled={loading}
          className="rounded-lg border border-steel-200 bg-white px-3 py-3 text-xs font-semibold text-steel-600 transition hover:bg-steel-50 disabled:opacity-60"
        >
          Use example
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  className,
  icon,
  iconColor,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  className: string;
  icon: string;
  iconColor: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <span
          className="pointer-events-none absolute left-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-[9px] font-bold text-white"
          style={{ background: iconColor }}
          aria-hidden
        >
          {icon}
        </span>
        <input
          id={id}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          className={`${className} pl-10 ${error ? "border-red-400" : "border-steel-200"}`}
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
