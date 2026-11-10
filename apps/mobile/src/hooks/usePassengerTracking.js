import { useEffect, useState } from "react";
import { fetchReverseGeocode } from "../api/gizegoApi.js";
import { useUserLocation } from "./useUserLocation.js";
import { useRealtime } from "../context/RealtimeContext.js";

/**
 * Real-time GPS + shared WebSocket: reports location and receives nearby buses.
 */
export function usePassengerTracking(enabled = true) {
  const loc = useUserLocation(enabled);
  const { nearbyBuses, reportPassengerLocation, socketConnected } = useRealtime();
  const [placeName, setPlaceName] = useState(null);
  const [followUser, setFollowUser] = useState(true);

  useEffect(() => {
    if (!enabled || !loc.coords) return undefined;

    reportPassengerLocation(loc.coords);
    const iv = setInterval(() => reportPassengerLocation(loc.coords), 4000);

    return () => clearInterval(iv);
  }, [
    enabled,
    loc.coords?.latitude,
    loc.coords?.longitude,
    loc.coords?.accuracy,
    reportPassengerLocation,
  ]);

  useEffect(() => {
    if (!loc.coords) return;
    const { latitude, longitude } = loc.coords;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchReverseGeocode(latitude, longitude);
        if (!cancelled && data?.place?.shortName) setPlaceName(data.place.shortName);
      } catch {
        if (!cancelled) setPlaceName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loc.coords?.latitude, loc.coords?.longitude]);

  return {
    ...loc,
    placeName,
    nearbyBuses,
    socketConnected,
    followUser,
    setFollowUser,
    mapRegion: followUser && loc.coords ? loc.centerRegion : undefined,
  };
}
