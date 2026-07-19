"""Persistence models for a computed trip and its ELD schedule.

A Trip stores the four inputs, the geocoded coordinates, the routed legs, the
overall totals and the full route geometry. Its schedule is normalised into
DutyDay -> DutySegment rows (for querying / the log sheets) and Stop rows (for
the map markers and remarks).
"""
from django.db import models


class Trip(models.Model):
    # --- inputs ---
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_used_hours = models.FloatField()

    # --- geocoded coordinates ---
    current_lat = models.FloatField(null=True, blank=True)
    current_lng = models.FloatField(null=True, blank=True)
    pickup_lat = models.FloatField(null=True, blank=True)
    pickup_lng = models.FloatField(null=True, blank=True)
    dropoff_lat = models.FloatField(null=True, blank=True)
    dropoff_lng = models.FloatField(null=True, blank=True)

    # --- routed legs ---
    leg1_miles = models.FloatField(default=0)
    leg1_hours = models.FloatField(default=0)
    leg2_miles = models.FloatField(default=0)
    leg2_hours = models.FloatField(default=0)

    # --- computed totals ---
    total_miles = models.FloatField(default=0)
    total_drive_hours = models.FloatField(default=0)
    total_on_duty_hours = models.FloatField(default=0)
    total_duration_hours = models.FloatField(default=0)
    total_days = models.IntegerField(default=0)

    # Full route polyline as [[lng, lat], ...] (both legs concatenated).
    route_geometry = models.JSONField(default=list, blank=True)
    routing_provider = models.CharField(max_length=32, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Trip {self.pk}: {self.current_location} -> {self.dropoff_location}"


class DutyDay(models.Model):
    trip = models.ForeignKey(Trip, related_name="days", on_delete=models.CASCADE)
    day_number = models.IntegerField()
    date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ["day_number"]
        unique_together = ("trip", "day_number")


class DutySegment(models.Model):
    class Status(models.TextChoices):
        OFF_DUTY = "OFF_DUTY"
        SLEEPER_BERTH = "SLEEPER_BERTH"
        DRIVING = "DRIVING"
        ON_DUTY_NOT_DRIVING = "ON_DUTY_NOT_DRIVING"

    duty_day = models.ForeignKey(DutyDay, related_name="segments", on_delete=models.CASCADE)
    start_hour = models.FloatField()  # hours past midnight (0..24)
    end_hour = models.FloatField()
    status = models.CharField(max_length=32, choices=Status.choices)
    location_label = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ["start_hour"]


class Stop(models.Model):
    class StopType(models.TextChoices):
        PICKUP = "pickup"
        DROPOFF = "dropoff"
        FUEL = "fuel"
        REST = "rest"
        RESTART = "restart"
        BREAK = "break"

    trip = models.ForeignKey(Trip, related_name="stops", on_delete=models.CASCADE)
    type = models.CharField(max_length=16, choices=StopType.choices)
    label = models.CharField(max_length=255)
    mile_marker = models.FloatField()
    start_hour = models.FloatField()  # absolute hours since trip start
    end_hour = models.FloatField()
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ["start_hour"]
