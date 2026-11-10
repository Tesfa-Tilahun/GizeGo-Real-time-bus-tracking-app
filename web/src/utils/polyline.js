/** Decode Google's encoded polyline to [ { latitude, longitude }, ... ]. */
export function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== "string") return [];
  const coords = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coords;
}

export function coordsFromRoute(route) {
  if (!route) return [];
  if (typeof route.polyline === "string" && route.polyline.trim()) {
    const decoded = decodePolyline(route.polyline);
    if (decoded.length > 1) return decoded;
  }
  const stops = route.stops;
  if (Array.isArray(stops) && stops.length > 1) {
    return [...stops]
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  }
  return [];
}

export function toLeafletLatLngs(coords) {
  return coords.map((c) => [c.latitude, c.longitude]);
}
