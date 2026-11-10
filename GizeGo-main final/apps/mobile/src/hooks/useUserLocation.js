import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import { ADDIS_ABABA, isInEthiopia } from "../config/ethiopiaMap.js";

/**
 * Real-time GPS for the device (FR4 — exact user location in Ethiopia).
 */
export function useUserLocation(enabled = true) {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [permission, setPermission] = useState(null);
  const [watching, setWatching] = useState(false);
  const subRef = useRef(null);

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    setWatching(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
    if (status !== "granted") {
      setError("Location permission is required for live tracking in Ethiopia.");
      return false;
    }

    const servicesOn = await Location.hasServicesEnabledAsync();
    if (!servicesOn) {
      setError("Turn on location services (GPS) on your device.");
      return false;
    }

    try {
      const last = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(last.coords);
      setError(null);
    } catch {
      /* watch will still try */
    }

    subRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 3000,
        distanceInterval: 4,
      },
      (fix) => {
        setCoords(fix.coords);
        setError(null);
      },
    );
    setWatching(true);
    return true;
  }, [stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return undefined;
    }
    void start();
    return stop;
  }, [enabled, start, stop]);

  const region = coords
    ? {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
      }
    : ADDIS_ABABA;

  const inEthiopia = coords ? isInEthiopia(coords.latitude, coords.longitude) : true;

  return {
    coords,
    error,
    permission,
    watching,
    region,
    inEthiopia,
    start,
    stop,
    centerRegion: region,
  };
}
