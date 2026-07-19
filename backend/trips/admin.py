from django.contrib import admin

from .models import DutyDay, DutySegment, Stop, Trip


class DutySegmentInline(admin.TabularInline):
    model = DutySegment
    extra = 0


class StopInline(admin.TabularInline):
    model = Stop
    extra = 0


@admin.register(Trip)
class TripAdmin(admin.ModelAdmin):
    list_display = ("id", "current_location", "dropoff_location", "total_miles",
                    "total_days", "created_at")
    inlines = [StopInline]


@admin.register(DutyDay)
class DutyDayAdmin(admin.ModelAdmin):
    list_display = ("trip", "day_number", "date")
    inlines = [DutySegmentInline]
