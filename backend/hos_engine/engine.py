"""The HOS scheduling engine — a pure state-machine simulation.

Given the two driving legs of a trip (current->pickup, pickup->dropoff) plus the
driver's already-used cycle hours, it plays the trip forward on a virtual clock,
inserting the breaks, fuel stops, 10-hour resets and 34-hour restarts that FMCSA
70h/8-day rules require, and emits a day-by-day record of duty statuses.

No Django imports — this module is unit-tested in isolation against the FMCSA
guide's worked examples.
"""
from __future__ import annotations

import math
from typing import List, Tuple

from . import constants as C
from .models import (
    DutyDay,
    DutySegment,
    DutyStatus,
    ScheduleResult,
    StopEvent,
    StopType,
)

_EPS = 1e-6

# An absolute-time segment before it is split into calendar days.
_RawSegment = Tuple[float, float, DutyStatus, str]


class _Simulation:
    """Mutable clock + HOS counters for a single trip."""

    def __init__(self, cycle_used_hours: float) -> None:
        self.t = 0.0                     # absolute hours since trip start (midnight day 1)
        self.window_start = 0.0          # t at which the current 14h duty window opened
        self.drive_in_period = 0.0       # driving hours since last 10h+ reset
        self.drive_since_break = 0.0     # driving hours since last qualifying break
        self.miles_since_fuel = 0.0
        self.total_miles = 0.0
        self.cycle_used = cycle_used_hours

        self.segments: List[_RawSegment] = []
        self.stops: List[StopEvent] = []
        self.total_drive_hours = 0.0
        self.total_on_duty_hours = 0.0

    # --- low-level segment emitters ---------------------------------------

    def _emit(self, duration: float, status: DutyStatus, label: str) -> None:
        if duration <= _EPS:
            return
        self.segments.append((self.t, self.t + duration, status, label))
        self.t += duration

    def _drive(self, hours: float, speed_mph: float) -> None:
        if hours <= _EPS:
            return
        miles = hours * speed_mph
        label = "Driving"
        self.segments.append((self.t, self.t + hours, DutyStatus.DRIVING, label))
        self.t += hours
        self.drive_in_period += hours
        self.drive_since_break += hours
        self.miles_since_fuel += miles
        self.total_miles += miles
        self.total_drive_hours += hours
        self.cycle_used += hours
        self.total_on_duty_hours += hours

    def _on_duty(self, hours: float, label: str, stop: StopType, mile: float) -> None:
        start = self.t
        self._emit(hours, DutyStatus.ON_DUTY_NOT_DRIVING, label)
        self.cycle_used += hours
        self.total_on_duty_hours += hours
        if hours >= C.BREAK_DURATION_HOURS - _EPS:
            self.drive_since_break = 0.0  # any 30min+ non-driving block satisfies the break
        self.stops.append(StopEvent(stop, label, round(mile, 1), start, self.t))

    def _off_duty(self, hours: float, label: str, stop: StopType, status: DutyStatus) -> None:
        start = self.t
        self._emit(hours, status, label)
        # A break of 30min+ satisfies the 30-minute rule.
        if hours >= C.BREAK_DURATION_HOURS - _EPS:
            self.drive_since_break = 0.0
        # 10h+ off duty resets the 11h and 14h clocks and opens a new window.
        if hours >= C.RESET_OFF_DUTY_HOURS - _EPS:
            self.drive_in_period = 0.0
            self.window_start = self.t
        # 34h+ off duty additionally restarts the 70h/8-day cycle.
        if hours >= C.RESTART_HOURS - _EPS:
            self.cycle_used = 0.0
        if stop in (StopType.REST, StopType.RESTART, StopType.BREAK):
            self.stops.append(
                StopEvent(stop, label, round(self.total_miles, 1), start, self.t)
            )

    # --- HOS-aware building blocks ----------------------------------------

    def _window_used(self) -> float:
        return self.t - self.window_start

    def _take_reset(self) -> None:
        self._off_duty(C.RESET_OFF_DUTY_HOURS, "10-hr off-duty reset",
                       StopType.REST, DutyStatus.SLEEPER_BERTH)

    def _take_restart(self) -> None:
        self._off_duty(C.RESTART_HOURS, "34-hr restart",
                       StopType.RESTART, DutyStatus.OFF_DUTY)

    def _take_break(self) -> None:
        self._off_duty(C.BREAK_DURATION_HOURS, "30-min break",
                       StopType.BREAK, DutyStatus.OFF_DUTY)

    def _take_fuel(self) -> None:
        self._on_duty(C.FUEL_DURATION_HOURS, "Fuel stop", StopType.FUEL, self.total_miles)
        self.miles_since_fuel = 0.0

    def drive_leg(self, miles: float, drive_hours: float) -> None:
        """Drive one leg, inserting fuel/break/reset/restart as HOS requires."""
        if drive_hours <= _EPS or miles <= _EPS:
            return
        speed = miles / drive_hours
        remaining = drive_hours

        while remaining > _EPS:
            # Resolve any exhausted clock before driving further (one remedy per pass).
            if self.cycle_used >= C.CYCLE_LIMIT_HOURS - _EPS:
                self._take_restart()
                continue
            if (self.drive_in_period >= C.DRIVE_LIMIT_HOURS - _EPS
                    or self._window_used() >= C.DUTY_WINDOW_HOURS - _EPS):
                self._take_reset()
                continue
            if self.drive_since_break >= C.DRIVE_BEFORE_BREAK_HOURS - _EPS:
                self._take_break()
                continue
            if self.miles_since_fuel >= C.FUEL_INTERVAL_MILES - _EPS:
                self._take_fuel()
                continue

            room_drive = C.DRIVE_LIMIT_HOURS - self.drive_in_period
            room_window = C.DUTY_WINDOW_HOURS - self._window_used()
            room_break = C.DRIVE_BEFORE_BREAK_HOURS - self.drive_since_break
            room_cycle = C.CYCLE_LIMIT_HOURS - self.cycle_used
            room_fuel = (C.FUEL_INTERVAL_MILES - self.miles_since_fuel) / speed

            chunk = min(remaining, room_drive, room_window, room_break, room_cycle, room_fuel)
            self._drive(chunk, speed)
            remaining -= chunk

    def do_on_duty_task(self, hours: float, label: str, stop: StopType, mile: float) -> None:
        """Pickup / drop-off. Restart first if it would breach the 70h cycle."""
        if self.cycle_used + hours > C.CYCLE_LIMIT_HOURS + _EPS:
            self._take_restart()
        self._on_duty(hours, label, stop, mile)


def _split_into_days(segments: List[_RawSegment]) -> List[DutyDay]:
    """Slice absolute-time segments at midnight boundaries into DutyDay objects."""
    if not segments:
        return [DutyDay(day_number=1, segments=[
            DutySegment(0.0, C.HOURS_PER_DAY, DutyStatus.OFF_DUTY, "Off duty")
        ])]

    end_t = segments[-1][1]
    num_days = max(1, math.ceil((end_t - _EPS) / C.HOURS_PER_DAY))
    days = [DutyDay(day_number=d + 1) for d in range(num_days)]

    for start, end, status, label in segments:
        first_day = int(start // C.HOURS_PER_DAY)
        last_day = int((end - _EPS) // C.HOURS_PER_DAY)
        for d in range(first_day, last_day + 1):
            day_start = d * C.HOURS_PER_DAY
            seg_start = max(start, day_start) - day_start
            seg_end = min(end, day_start + C.HOURS_PER_DAY) - day_start
            if seg_end - seg_start > _EPS:
                # Only the day where the segment truly starts carries the remark
                # label; continuations into later days are left blank.
                is_continuation = start < day_start - _EPS
                days[d].segments.append(
                    DutySegment(round(seg_start, 4), round(seg_end, 4), status,
                                "" if is_continuation else label)
                )

    # Pad the trailing remainder of the final day with off-duty time.
    last_day_index = num_days - 1
    covered_to = end_t - last_day_index * C.HOURS_PER_DAY
    if covered_to < C.HOURS_PER_DAY - _EPS:
        days[last_day_index].segments.append(
            DutySegment(round(covered_to, 4), C.HOURS_PER_DAY, DutyStatus.OFF_DUTY, "Off duty")
        )
    return days


def build_schedule(
    current_to_pickup_miles: float,
    current_to_pickup_drive_hours: float,
    pickup_to_dropoff_miles: float,
    pickup_to_dropoff_drive_hours: float,
    cycle_used_hours: float,
) -> ScheduleResult:
    """Build a compliant duty schedule for the trip.

    Timeline: drive current->pickup, 1h pickup (on-duty), drive pickup->dropoff,
    1h drop-off (on-duty). Fuel every 1,000 mi; breaks/resets/restarts inserted as
    the 70h/8-day HOS rules require.
    """
    if cycle_used_hours < 0 or cycle_used_hours > C.CYCLE_LIMIT_HOURS:
        raise ValueError("cycle_used_hours must be between 0 and 70")

    sim = _Simulation(cycle_used_hours)

    sim.drive_leg(current_to_pickup_miles, current_to_pickup_drive_hours)
    sim.do_on_duty_task(C.PICKUP_DURATION_HOURS, "Pickup", StopType.PICKUP,
                        current_to_pickup_miles)
    sim.drive_leg(pickup_to_dropoff_miles, pickup_to_dropoff_drive_hours)
    sim.do_on_duty_task(C.DROPOFF_DURATION_HOURS, "Drop-off", StopType.DROPOFF,
                        current_to_pickup_miles + pickup_to_dropoff_miles)

    days = _split_into_days(sim.segments)
    return ScheduleResult(
        days=days,
        stops=sim.stops,
        total_drive_hours=round(sim.total_drive_hours, 4),
        total_on_duty_hours=round(sim.total_on_duty_hours, 4),
        total_miles=round(sim.total_miles, 1),
        total_duration_hours=round(sim.t, 4),
    )
