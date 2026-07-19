import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LogSheet from "./LogSheet";
import { sampleDay } from "../test/fixtures";

function renderSheet() {
  return render(
    <LogSheet
      day={sampleDay}
      fromLabel="Richmond, VA"
      toLabel="Newark, NJ"
      milesToday={480}
      totalMilesTrip={1740}
      driverCycleUsed={8}
    />,
  );
}

describe("LogSheet", () => {
  it("renders the four duty-status rows", () => {
    renderSheet();
    expect(screen.getByText("1. Off Duty")).toBeInTheDocument();
    expect(screen.getByText("2. Sleeper Berth")).toBeInTheDocument();
    expect(screen.getByText("3. Driving")).toBeInTheDocument();
    expect(screen.getByText("4. On Duty (not driving)")).toBeInTheDocument();
  });

  it("renders an accessible 24-hour grid", () => {
    renderSheet();
    expect(screen.getByRole("img", { name: /daily log grid for day 1/i })).toBeInTheDocument();
  });

  it("renders per-row totals matching the FMCSA John Doe example", () => {
    renderSheet();
    // Driving 7.75h -> "7h 45m"; On-duty 4.5h -> "4h 30m"; sleeper 1.75h -> "1h 45m".
    expect(screen.getAllByText("7h 45m").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("4h 30m")).toBeInTheDocument();
    expect(screen.getByText("1h 45m")).toBeInTheDocument();
  });

  it("labels the remarks row at status changes", () => {
    renderSheet();
    expect(screen.getByText("Fuel stop")).toBeInTheDocument();
    expect(screen.getByText("Drop-off")).toBeInTheDocument();
  });

  it("draws one duty bar per segment", () => {
    const { container } = renderSheet();
    const bars = container.querySelectorAll('line[stroke-width="3.6"]');
    expect(bars.length).toBe(sampleDay.segments.length);
  });
});
