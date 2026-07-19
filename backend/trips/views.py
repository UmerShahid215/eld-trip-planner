from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Trip
from .serializers import (
    DutyDaySerializer,
    TripInputSerializer,
    TripSerializer,
)
from .services.geocoding import GeocodingError, get_geocoder
from .services.planner import plan_trip
from .services.routing import RoutingError, get_router


@extend_schema_view(
    retrieve=extend_schema(
        summary="Retrieve a planned trip",
        description="Return the full trip record including route geometry, stops, and per-day duty segments.",
        responses={200: TripSerializer},
    ),
)
class TripViewSet(viewsets.ReadOnlyModelViewSet):
    """POST /api/trips/           -> compute + persist a trip
    GET  /api/trips/{id}/        -> retrieve a computed trip
    GET  /api/trips/{id}/logs/   -> per-day duty segments for the log sheets
    """

    queryset = Trip.objects.all().prefetch_related("days__segments", "stops")
    serializer_class = TripSerializer

    @extend_schema(
        summary="Plan a trip",
        description=(
            "Geocode the three locations, route both legs via OpenRouteService "
            "(driving-hgv profile), run the FMCSA Hours-of-Service engine, persist "
            "the result, and return the full schedule with route geometry and daily "
            "log data.\n\n"
            "**HOS rules enforced (49 CFR Part 395):**\n"
            "- 11-hour driving limit per duty period\n"
            "- 14-hour on-duty window (breaks do not extend it)\n"
            "- 30-minute break after 8 cumulative driving hours\n"
            "- 10-hour off-duty reset\n"
            "- 70-hour / 8-day rolling cycle\n"
            "- 34-hour restart when remaining cycle hours are insufficient\n"
            "- Fuel stop (30 min on-duty) every 1,000 miles"
        ),
        request=TripInputSerializer,
        responses={
            201: TripSerializer,
            400: OpenApiResponse(description="Validation error, geocoding failure, or routing failure."),
        },
    )
    def create(self, request, *args, **kwargs):
        input_serializer = TripInputSerializer(data=request.data)
        input_serializer.is_valid(raise_exception=True)
        data = input_serializer.validated_data

        try:
            trip = plan_trip(
                current_location=data["current_location"],
                pickup_location=data["pickup_location"],
                dropoff_location=data["dropoff_location"],
                current_cycle_used_hours=data["current_cycle_used_hours"],
                geocoder=get_geocoder(),
                router=get_router(),
            )
        except GeocodingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except RoutingError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        output = TripSerializer(trip)
        return Response(output.data, status=status.HTTP_201_CREATED)

    @extend_schema(
        summary="Daily log sheets",
        description=(
            "Return per-day duty segments formatted for the ELD log-sheet renderer. "
            "Each day includes a `totals` map of duty-status → hours."
        ),
        responses={200: DutyDaySerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        trip = self.get_object()
        days = trip.days.all().prefetch_related("segments")
        return Response({
            "trip_id": trip.id,
            "total_days": trip.total_days,
            "days": DutyDaySerializer(days, many=True).data,
        })
