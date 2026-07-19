"""Value objects returned by the HOS engine.

Pure dataclasses / enums with zero Django dependency so the engine can be unit
tested in isolation. Times are expressed as floating-point *hours since trip
start* (t=0 is midnight at the start of day 1). Helpers convert to per-day,
midnight-to-midnight structures for rendering.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List

from . import constants


class DutyStatus(str, Enum):
    """The four ELD duty statuses (log-grid rows, top to bottom)."""

    OFF_DUTY = "OFF_DUTY"
    SLEEPER_BERTH = "SLEEPER_BERTH"
    DRIVING = "DRIVING"
    ON_DUTY_NOT_DRIVING = "ON_DUTY_NOT_DRIVING"


class StopType(str, Enum):
    PICKUP = "pickup"
    DROPOFF = "dropoff"
    FUEL = "fuel"
    REST = "rest"          # 10-hour off-duty reset
    RESTART = "restart"    # 34-hour cycle restart
    BREAK = "break"        # 30-minute break


@dataclass
class DutySegment:
    """A contiguous block of a single duty status within one calendar day.

    start_hour / end_hour are hours-past-midnight within that day (0..24).
    """

    start_hour: float
    end_hour: float
    status: DutyStatus
    location_label: str = ""

    @property
    def duration_hours(self) -> float:
        return round(self.end_hour - self.start_hour, 4)


@dataclass
class DutyDay:
    """One midnight-to-midnight period with its ordered duty segments."""

    day_number: int  # 1-based
    segments: List[DutySegment] = field(default_factory=list)

    def totals_by_status(self) -> Dict[str, float]:
        """Sum segment durations per status. Validates against FMCSA log totals."""
        totals = {status.value: 0.0 for status in DutyStatus}
        for seg in self.segments:
            totals[seg.status.value] += seg.duration_hours
        return {k: round(v, 4) for k, v in totals.items()}

    @property
    def total_hours(self) -> float:
        return round(sum(seg.duration_hours for seg in self.segments), 4)

    @property
    def total_on_duty_hours(self) -> float:
        """Driving + on-duty-not-driving — the hours that count toward the cycle."""
        t = self.totals_by_status()
        return round(
            t[DutyStatus.DRIVING.value] + t[DutyStatus.ON_DUTY_NOT_DRIVING.value], 4
        )


@dataclass
class StopEvent:
    """A notable stop along the trip (for the map + remarks)."""

    type: StopType
    label: str
    mile_marker: float           # cumulative trip miles driven when the stop occurs
    start_hour: float            # absolute hours since trip start
    end_hour: float              # absolute hours since trip start

    @property
    def duration_hours(self) -> float:
        return round(self.end_hour - self.start_hour, 4)


@dataclass
class ScheduleResult:
    days: List[DutyDay]
    stops: List[StopEvent]
    total_drive_hours: float
    total_on_duty_hours: float
    total_miles: float
    total_duration_hours: float

    @property
    def total_days(self) -> int:
        return len(self.days)

    @property
    def restarts_used(self) -> List[StopEvent]:
        return [s for s in self.stops if s.type == StopType.RESTART]


def rolling_8day_on_duty_totals(daily_on_duty_hours: List[float]) -> List[float]:
    """Rolling trailing-8-day on-duty totals for the 70h/8-day rule.

    For each day i, sum that day's on-duty hours plus the prior 7 days
    (the oldest day drops off as the window slides). Validates against the
    FMCSA Interstate Truck Driver's Guide Days 1-10 worked example.
    """
    window = constants.CYCLE_WINDOW_DAYS
    totals: List[float] = []
    for i in range(len(daily_on_duty_hours)):
        start = max(0, i - window + 1)
        totals.append(round(sum(daily_on_duty_hours[start : i + 1]), 4))
    return totals
