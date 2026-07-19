import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TripForm from "./TripForm";

describe("TripForm", () => {
  it("renders the four inputs and submit button", () => {
    render(<TripForm onSubmit={vi.fn()} loading={false} />);
    expect(screen.getByLabelText(/current location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/pickup location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/drop-off location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current cycle used/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /plan trip/i })).toBeInTheDocument();
  });

  it("shows validation errors and does not submit when empty", async () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    await userEvent.click(screen.getByRole("button", { name: /plan trip/i }));
    expect(await screen.findByText(/enter a starting location/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects cycle hours outside 0–70", async () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    await userEvent.type(screen.getByLabelText(/current location/i), "Richmond, VA");
    await userEvent.type(screen.getByLabelText(/pickup location/i), "Columbus, OH");
    await userEvent.type(screen.getByLabelText(/drop-off location/i), "Denver, CO");
    await userEvent.type(screen.getByLabelText(/current cycle used/i), "80");
    await userEvent.click(screen.getByRole("button", { name: /plan trip/i }));
    expect(await screen.findByText(/between 0 and 70/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits validated input", async () => {
    const onSubmit = vi.fn();
    render(<TripForm onSubmit={onSubmit} loading={false} />);
    await userEvent.click(screen.getByRole("button", { name: /use example/i }));
    await userEvent.click(screen.getByRole("button", { name: /plan trip/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      current_location: "Richmond, VA",
      pickup_location: "Columbus, OH",
      dropoff_location: "Denver, CO",
      current_cycle_used_hours: 8,
    });
  });
});
