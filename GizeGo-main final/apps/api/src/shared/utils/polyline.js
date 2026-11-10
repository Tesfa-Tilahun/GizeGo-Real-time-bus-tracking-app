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

/** Encode [{ latitude, longitude }, ...] as Google/OSM polyline string. */
export function encodePolyline(coords) {
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

/** Decode Google's encoded polyline to [{ latitude, longitude }, ...]. */
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

    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coords;
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
        traveledMeters: Math.max(0, dist),
        totalMeters: total,
      };
    }
  }

  const last = coords[coords.length - 1];
  return { point: last, headingDeg: 0, remainingMeters: 0, traveledMeters: total, totalMeters: total };
}

export function pathTotalMeters(coords) {
  if (!coords?.length || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i]);
  }
  return total;
}

/** Normalized arc-length progress [0,1] for the nearest point on the path. */
export function progressAtNearestPoint(coords, point) {
  if (!coords?.length || !point) return 0;
  if (coords.length === 1) return 0;

  let total = 0;
  const segments = [];
  for (let i = 1; i < coords.length; i++) {
    const length = haversineMeters(coords[i - 1], coords[i]);
    segments.push({ index: i, start: total, length, from: coords[i - 1], to: coords[i] });
    total += length;
  }
  if (total <= 0) return 0;

  let bestDist = Infinity;
  let bestArc = 0;
  for (const seg of segments) {
    const projected = projectPointOnSegment(point, seg.from, seg.to);
    const d = haversineMeters(point, projected);
    const arc = seg.start + seg.length * projected.t;
    if (d < bestDist) {
      bestDist = d;
      bestArc = arc;
    }
  }
  return Math.max(0, Math.min(1, bestArc / total));
}

/** Remaining meters along path from progressA to progressB (A before B). */
export function remainingMetersBetweenProgress(coords, fromProgress, toProgress) {
  const total = pathTotalMeters(coords);
  if (total <= 0) return 0;
  const delta = Math.max(0, toProgress - fromProgress);
  return delta * total;
}

function projectPointOnSegment(point, from, to) {
  const lat1 = from.latitude;
  const lng1 = from.longitude;
  const lat2 = to.latitude;
  const lng2 = to.longitude;
  const lat = point.latitude;
  const lng = point.longitude;
  const dx = lat2 - lat1;
  const dy = lng2 - lng1;
  const len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((lat - lat1) * dx + (lng - lng1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return {
    latitude: lat1 + t * dx,
    longitude: lng1 + t * dy,
    t,
  };
}

/** Down-sample dense OSM paths for A* graph (max ~80 nodes). */
export function simplifyPath(coords, maxPoints = 80) {
  if (!coords?.length) return [];
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
