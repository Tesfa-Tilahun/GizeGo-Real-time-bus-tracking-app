import { fetchReverseGeocode } from "../api/gizegoApi.js";
import { canonicalPlaceName } from "./searchText.js";

/**
 * Resolve departure/arrival for route search.
 * Departure may be typed, from reverse-geocoded GPS, or coords-only (nearest stop on server).
 */
export async function resolveTripEndpoints({
  departure = "",
  arrival = "",
  coords = null,
  placeName = "",
}) {
  const to = canonicalPlaceName(arrival);
  if (!to) {
    return { error: "arrival_required" };
  }

  let from = canonicalPlaceName(departure);
  let fromLat;
  let fromLng;

  if (coords) {
    fromLat = coords.latitude;
    fromLng = coords.longitude;
    // Let the API snap GPS to the nearest bus stop / canonical area.
    from = "";
  }

  if (!from && placeName?.trim() && !coords) {
    from = canonicalPlaceName(placeName);
  }

  if (!from && coords) {
    try {
      const data = await fetchReverseGeocode(coords.latitude, coords.longitude);
      const name = data?.canonicalLocation?.canonicalName?.trim() || "";
      if (name) from = name;
    } catch {
      /* coords-only search still works */
    }
  }

  if (!from && (fromLat == null || fromLng == null)) {
    return { error: "departure_required" };
  }

  return {
    from,
    to,
    fromLat,
    fromLng,
  };
}
