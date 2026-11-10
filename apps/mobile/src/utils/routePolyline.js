/**
 * Encode [ { latitude, longitude }, ... ] using Google's encoded polyline algorithm (5 decimal places).
 * Matches backend expectation for route.polyline TEXT.
 */

function encodeSignedNumber(num) {
  let sgn = num < 0 ? ~(num << 1) : num << 1;
  let chunk = "";
  while (sgn >= 0x20) {
    chunk += String.fromCharCode((0x20 | (sgn & 0x1f)) + 63);
    sgn >>= 5;
  }
  chunk += String.fromCharCode(sgn + 63);
  return chunk;
}

export function encodePolylineFromLngLats(coords) {
  let output = "";
  let prevLat = 0;
  let prevLng = 0;
  for (const c of coords) {
    const lat = Math.round(Number(c.latitude) * 1e5);
    const lng = Math.round(Number(c.longitude) * 1e5);
    output += encodeSignedNumber(lat - prevLat);
    output += encodeSignedNumber(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return output;
}

/**
 * Decode Google's encoded polyline to [ { latitude, longitude }, ... ].
 * @param {string} encoded
 */
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

/** Total path length along stop order (meters). */
export function approximatePathMeters(coords) {
  if (coords.length < 2) return 0;
  const R = 6371000;
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    const lat1 = (Number(coords[i - 1].latitude) * Math.PI) / 180;
    const lat2 = (Number(coords[i].latitude) * Math.PI) / 180;
    const dLat = lat2 - lat1;
    const dLon = ((Number(coords[i].longitude) - Number(coords[i - 1].longitude)) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    sum += 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  return Math.round(sum);
}

function haversineMeters(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** @returns {{ point: { latitude: number, longitude: number }, headingDeg: number, remainingMeters: number } | null} */
export function pointAlongPath(coords, progress) {
  if (!coords?.length) return null;
  if (coords.length === 1) {
    return { point: coords[0], headingDeg: 0, remainingMeters: 0 };
  }

  const segments = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const length = haversineMeters(coords[i - 1], coords[i]);
    segments.push({ from: coords[i - 1], to: coords[i], length, start: total });
    total += length;
  }

  if (total <= 0) {
    return { point: coords[0], headingDeg: 0, remainingMeters: 0 };
  }

  const p = Math.max(0, Math.min(1, progress));
  let dist = p * total;
  if (dist >= total) dist = total - 0.001;

  for (const seg of segments) {
    if (dist <= seg.start + seg.length) {
      const t = seg.length > 0 ? (dist - seg.start) / seg.length : 0;
      const latitude = seg.from.latitude + t * (seg.to.latitude - seg.from.latitude);
      const longitude = seg.from.longitude + t * (seg.to.longitude - seg.from.longitude);
      const headingRad = Math.atan2(
        seg.to.longitude - seg.from.longitude,
        seg.to.latitude - seg.from.latitude,
      );
      const headingDeg = ((headingRad * 180) / Math.PI + 360) % 360;
      return {
        point: { latitude, longitude },
        headingDeg,
        remainingMeters: Math.max(0, total - dist),
      };
    }
  }

  const last = coords[coords.length - 1];
  return { point: last, headingDeg: 0, remainingMeters: 0 };
}
