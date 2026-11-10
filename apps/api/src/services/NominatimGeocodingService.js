import { AppError } from "../shared/errors/AppError.js";

const NOMINATIM = "https://nominatim.openstreetmap.org";
const USER_AGENT = process.env.NOMINATIM_USER_AGENT?.trim() || "GizeGo/1.0 (Addis Ababa transport; contact: dev@gizego.local)";
const GOOGLE_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Ethiopian place search & reverse geocoding via OpenStreetMap Nominatim.
 */
export class NominatimGeocodingService {
  async searchEthiopia(query, limit = 8) {
    const q = query?.trim();
    if (!q || q.length < 2) return [];

    const url =
      `${NOMINATIM}/search?` +
      new URLSearchParams({
        format: "json",
        q,
        countrycodes: "et",
        limit: String(limit),
        addressdetails: "1",
      }).toString();

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      throw new AppError(`Geocoding failed (${res.status})`, 502);
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];

    return rows.map((r) => ({
      name: r.display_name,
      shortName: r.name || r.display_name?.split(",")?.[0] || q,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      type: r.type,
      source: "openstreetmap-nominatim",
    }));
  }

  async reverseGeocode(latitude, longitude) {
    const google = await this.reverseGeocodeWithGoogle(latitude, longitude);
    if (google) return google;

    const url =
      `${NOMINATIM}/reverse?` +
      new URLSearchParams({
        format: "json",
        lat: String(latitude),
        lon: String(longitude),
        zoom: "16",
        addressdetails: "1",
      }).toString();

    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.display_name,
      shortName: data.name || data.display_name?.split(",")?.[0],
      latitude,
      longitude,
      source: "openstreetmap-nominatim",
    };
  }

  async reverseGeocodeWithGoogle(latitude, longitude) {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) return null;

    const url =
      `${GOOGLE_GEOCODE}?` +
      new URLSearchParams({
        latlng: `${latitude},${longitude}`,
        key,
        language: "en",
        region: "et",
      }).toString();

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const first = Array.isArray(data.results) ? data.results[0] : null;
    if (!first) return null;
    const component =
      first.address_components?.find((c) =>
        c.types?.some((t) => ["point_of_interest", "route", "sublocality", "neighborhood"].includes(t)),
      ) ?? first.address_components?.[0];
    return {
      name: first.formatted_address,
      shortName: component?.long_name || first.formatted_address?.split(",")?.[0],
      latitude,
      longitude,
      source: "google-maps-geocoding",
      placeId: first.place_id ?? null,
    };
  }
}

export const nominatimGeocoding = new NominatimGeocodingService();
