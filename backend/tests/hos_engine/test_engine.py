"""Unit tests for the pure HOS engine.

Validated first against the FMCSA Interstate Truck Driver's Guide worked examples
(the "John Doe" completed log and the rolling 8-day total table), then against
the rule-by-rule behaviour of build_schedule.
"""
import pytest

from hos_engine import (
    DutyDay,
    DutySegment,
    DutyStatus,
    StopType,
    build_schedule,
    rolling_8day_on_duty_totals,
)
from hos_engine import constants as C

OFF = DutyStatus.OFF_DUTY
SB = DutyStatus.SLEEPER_BERTH
DR = DutyStatus.DRIVING
ON = DutyStatus.ON_DUTY_NOT_DRIVING


# --------------------------------------------------------------------------
# FMCSA example 1: the "John Doe" completed daily log.
# Richmond, VA -> Newark, NJ. The published totals are:
#   Driving 7.75, On-duty(not driving) 4.5, Sleeper berth 1.75, Off duty 10 = 24h.
# This validates the segment-building and per-status totalling logic.
# --------------------------------------------------------------------------
def test_john_doe_log_totals():
    day = DutyDay(
        day_number=1,
        segments=[
            DutySegment(0.00, 6.00, OFF, "Richmond, VA"),       # 6.00 off
            DutySegment(6.00, 9.00, DR, "En route"),            # 3.00 drive
            DutySegment(9.00, 10.00, ON, "Fuel / inspection"),  # 1.00 on-duty
            DutySegment(10.00, 14.75, DR, "En route"),          # 4.75 drive
            DutySegment(14.75, 18.25, ON, "Newark, NJ"),        # 3.50 on-duty
            DutySegment(18.25, 20.00, SB, "Sleeper"),           # 1.75 sleeper
            DutySegment(20.00, 24.00, OFF, "Off duty"),         # 4.00 off
        ],
    )
    totals = day.totals_by_status()
    assert totals[DR.value] == pytest.approx(7.75)
    assert totals[ON.value] == pytest.approx(4.5)
    assert totals[SB.value] == pytest.approx(1.75)
    assert totals[OFF.value] == pytest.approx(10.0)
    assert day.total_hours == pytest.approx(24.0)
    assert day.total_on_duty_hours == pytest.approx(12.25)  # driving + on-duty


# --------------------------------------------------------------------------
# FMCSA example 2: the rolling 8-day total table.
# Daily on-duty hours whose trailing-8-day sums reproduce the guide's
# 67 / 73 / 63 totals as the window slides and the oldest day drops off.
# --------------------------------------------------------------------------
def test_rolling_8day_window():
    daily = [8, 11, 10, 9, 8, 7, 6, 8, 14, 1]
    #        d1 d2 d3 d4 d5 d6 d7 d8 d9 d10
    expected = [8, 19, 29, 38, 46, 53, 59, 67, 73, 63]
    #   day8 = d1..d8 = 67   day9 drops d1, adds d9 = 73   day10 drops d2 = 63
    assert rolling_8day_on_duty_totals(daily) == expected


# --------------------------------------------------------------------------
# build_schedule: rule-by-rule behaviour.
# --------------------------------------------------------------------------
def test_short_trip_no_interruptions():
    r = build_schedule(60, 1.0, 120, 2.0, cycle_used_hours=0.0)
    assert r.total_drive_hours == pytest.approx(3.0)
    assert r.total_on_duty_hours == pytest.approx(5.0)  # 3 drive + 1 pickup + 1 dropoff
    assert r.total_miles == pytest.approx(180.0)
    # 1h drive + 1h pickup + 2h drive + 1h dropoff = 5h, single day.
    assert r.total_duration_hours == pytest.approx(5.0)
    assert r.total_days == 1
    stop_types = {s.type for s in r.stops}
    assert stop_types == {StopType.PICKUP, StopType.DROPOFF}


def test_30_minute_break_after_8h_driving():
    # 600 mi @ 60 mph = 10h driving in one leg -> a 30-min break after 8h.
    r = build_schedule(600, 10.0, 60, 1.0, cycle_used_hours=0.0)
    breaks = [s for s in r.stops if s.type == StopType.BREAK]
    assert len(breaks) == 1
    # The break lands right at 8 cumulative driving hours (label at ~480 mi).
    assert breaks[0].mile_marker == pytest.approx(480.0, abs=1.0)


def test_fuel_stop_every_1000_miles():
    r = build_schedule(1100, 18.0, 50, 1.0, cycle_used_hours=0.0)
    fuels = [s for s in r.stops if s.type == StopType.FUEL]
    assert len(fuels) >= 1
    assert fuels[0].mile_marker == pytest.approx(1000.0, abs=1.0)


def test_multi_day_trip_uses_resets_and_spans_days():
    # ~2200 mi total, ~36.5h driving -> multiple duty periods across several days.
    r = build_schedule(200, 3.5, 2000, 33.0, cycle_used_hours=0.0)
    assert r.total_drive_hours == pytest.approx(36.5)
    assert r.total_miles == pytest.approx(2200.0)
    assert r.total_days >= 3
    rests = [s for s in r.stops if s.type == StopType.REST]
    assert len(rests) >= 3  # needs several 10h resets to cover 36.5h of driving
    # Every rendered day must cover a full 24h (continuity + padding).
    for day in r.days:
        assert day.total_hours == pytest.approx(24.0, abs=1e-3)


def test_34h_restart_when_cycle_would_be_exceeded():
    # Only 2h of cycle left; a trip needing more on-duty must take a 34h restart.
    r = build_schedule(300, 5.0, 100, 2.0, cycle_used_hours=68.0)
    assert len(r.restarts_used) >= 1
    assert r.restarts_used[0].type == StopType.RESTART


def test_driving_never_exceeds_11h_per_period():
    r = build_schedule(200, 3.5, 2000, 33.0, cycle_used_hours=0.0)
    # Reconstruct driving hours between consecutive 10h+ resets from the flat
    # per-day segments: driving in any single duty period must be <= 11h.
    driving_run = 0.0
    max_run = 0.0
    for day in r.days:
        for seg in day.segments:
            if seg.status == DR:
                driving_run += seg.duration_hours
                max_run = max(max_run, driving_run)
            elif seg.status in (OFF, SB) and seg.duration_hours >= C.RESET_OFF_DUTY_HOURS - 1e-6:
                driving_run = 0.0
    assert max_run <= C.DRIVE_LIMIT_HOURS + 1e-3


@pytest.mark.parametrize("bad", [-1.0, 70.1, 100.0])
def test_invalid_cycle_hours_rejected(bad):
    with pytest.raises(ValueError):
        build_schedule(60, 1.0, 120, 2.0, cycle_used_hours=bad)
