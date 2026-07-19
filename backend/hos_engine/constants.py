"""Fixed FMCSA Hours-of-Service parameters for a property-carrying driver (70h/8-day).

These are hardcoded business assumptions from 49 CFR Part 395 and the FMCSA
Interstate Truck Driver's Guide to Hours of Service. They are intentionally not
configurable — the assessment fixes them.
"""

# --- Driving / duty limits (hours) ---
DRIVE_LIMIT_HOURS = 11.0          # Max driving within a single duty period.
DUTY_WINDOW_HOURS = 14.0          # Driving must stop 14h after the window opens.
DRIVE_BEFORE_BREAK_HOURS = 8.0    # Cumulative driving allowed before a 30-min break.
BREAK_DURATION_HOURS = 0.5        # Required non-driving break length.
RESET_OFF_DUTY_HOURS = 10.0       # Consecutive off-duty needed to reset 11h/14h clocks.

# --- 70-hour / 8-day cycle ---
CYCLE_LIMIT_HOURS = 70.0          # Max on-duty hours in the rolling 8-day window.
CYCLE_WINDOW_DAYS = 8
RESTART_HOURS = 34.0              # Consecutive off-duty that resets the cycle to zero.

# --- Fuel ---
FUEL_INTERVAL_MILES = 1000.0      # Fuel at least this often.
FUEL_DURATION_HOURS = 0.5         # On-duty (not driving) time per fueling.

# --- Pickup / drop-off ---
PICKUP_DURATION_HOURS = 1.0       # On-duty (not driving) at pickup.
DROPOFF_DURATION_HOURS = 1.0      # On-duty (not driving) at drop-off.

HOURS_PER_DAY = 24.0
