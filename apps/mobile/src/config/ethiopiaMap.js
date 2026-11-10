/** Addis Ababa — default map center for GizeGo (Ethiopia). */
export const ADDIS_ABABA = {
  latitude: 9.032,
  longitude: 38.7469,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/** Rough bounds for fitting the map to Ethiopia. */
export const ETHIOPIA_BOUNDS = {
  north: 14.9,
  south: 3.4,
  east: 48.0,
  west: 32.9,
};

/**
 * Raster map tiles for react-native-maps UrlTile.
 * Do not use tile.openstreetmap.org — OSM returns 403 for typical mobile app traffic.
 * CARTO Voyager is OSM-based, free for apps, and works nationwide (no API key).
 * @see https://carto.com/attributions/
 */
export const MAP_TILE_URL =
  "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

export const MAP_ATTRIBUTION = "© OpenStreetMap · CARTO";

/** @deprecated Use MAP_TILE_URL */
export const OSM_TILE_URL = MAP_TILE_URL;

export function isInEthiopia(latitude, longitude) {
  return (
    latitude >= ETHIOPIA_BOUNDS.south &&
    latitude <= ETHIOPIA_BOUNDS.north &&
    longitude >= ETHIOPIA_BOUNDS.west &&
    longitude <= ETHIOPIA_BOUNDS.east
  );
}

export function formatCoords(latitude, longitude) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
