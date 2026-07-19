from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Trip
from .serializers import (
    DutyDaySerializer,
    TripInputSerializer,
    TripSerializer,
)
from .services.geocoding import GeocodingError, NominatimGeocoder
from .services.planner import plan_trip
from .services.routing import RoutingError, get_router


class TripViewSet(viewsets.ReadOnlyModelViewSet):
    """POST /api/trips/           -> compute + persist a trip
    GET  /api/trips/{id}/        -> retrieve a computed trip
    GET  /api/trips/{id}/logs/   -> per-day duty segments for the log sheets
    """

    queryset = Trip.objects.all().prefetch_related("days__segments", "stops")
    serializer_class = TripSerializer

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
                geocoder=NominatimGeocoder(),
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

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        trip = self.get_object()
        days = trip.days.all().prefetch_related("segments")
        return Response({
            "trip_id": trip.id,
            "total_days": trip.total_days,
            "days": DutyDaySerializer(days, many=True).data,
        })
