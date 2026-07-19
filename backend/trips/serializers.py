from rest_framework import serializers

from hos_engine import constants as C

from .models import DutyDay, DutySegment, Stop, Trip


class TripInputSerializer(serializers.Serializer):
    """Validates the four trip inputs from the form."""

    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_used_hours = serializers.FloatField(
        min_value=0.0, max_value=C.CYCLE_LIMIT_HOURS
    )


class DutySegmentSerializer(serializers.ModelSerializer):
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = DutySegment
        fields = ["start_hour", "end_hour", "status", "location_label", "duration_hours"]

    def get_duration_hours(self, obj):
        return round(obj.end_hour - obj.start_hour, 4)


class DutyDaySerializer(serializers.ModelSerializer):
    segments = DutySegmentSerializer(many=True, read_only=True)
    totals = serializers.SerializerMethodField()

    class Meta:
        model = DutyDay
        fields = ["day_number", "date", "segments", "totals"]

    def get_totals(self, obj):
        totals = {s.value: 0.0 for s in [
            DutySegment.Status.OFF_DUTY,
            DutySegment.Status.SLEEPER_BERTH,
            DutySegment.Status.DRIVING,
            DutySegment.Status.ON_DUTY_NOT_DRIVING,
        ]}
        for seg in obj.segments.all():
            totals[seg.status] += round(seg.end_hour - seg.start_hour, 4)
        return {k: round(v, 4) for k, v in totals.items()}


class StopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stop
        fields = ["type", "label", "mile_marker", "start_hour", "end_hour", "lat", "lng"]


class TripSerializer(serializers.ModelSerializer):
    days = DutyDaySerializer(many=True, read_only=True)
    stops = StopSerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = [
            "id",
            "current_location", "pickup_location", "dropoff_location",
            "current_cycle_used_hours",
            "current_lat", "current_lng",
            "pickup_lat", "pickup_lng",
            "dropoff_lat", "dropoff_lng",
            "leg1_miles", "leg1_hours", "leg2_miles", "leg2_hours",
            "total_miles", "total_drive_hours", "total_on_duty_hours",
            "total_duration_hours", "total_days",
            "route_geometry", "routing_provider",
            "created_at",
            "days", "stops",
        ]
