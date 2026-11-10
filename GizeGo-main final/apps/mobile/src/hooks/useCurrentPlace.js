import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { fetchReverseGeocode } from "../api/gizegoApi.js";

/**
 * Resolves the device's current coordinates and a human-readable place name (Ethiopia).
 */
export function useCurrentPlace(enabled = true) {
  const [coords, setCoords] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission is required to use your current position.");
        return null;
      }

      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        setError("Turn on location services (GPS) on your device.");
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(pos.coords);

      const data = await fetchReverseGeocode(pos.coords.latitude, pos.coords.longitude);
      const canonical =
        data?.canonicalLocation?.canonicalName?.trim() ||
        "";
      const raw =
        data?.place?.shortName?.trim() ||
        data?.place?.displayName?.trim() ||
        "";
      const name = canonical || raw;
      if (name) setPlaceName(name);

      return {
        coords: pos.coords,
        placeName: name,
        canonicalName: canonical || null,
        reverseGeocodeName: raw && canonical && raw !== canonical ? raw : null,
      };
    } catch {
      setError("Could not read your current location.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    void refresh();
    return undefined;
  }, [enabled, refresh]);

  return {
    coords,
    placeName,
    loading,
    error,
    refresh,
  };
}
